import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultPackageRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"..",
);
const registryUrl = "https://registry.npmjs.org";
const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

type StableVersion = readonly [major: number, minor: number, patch: number];

function parseStableVersion(version: string): StableVersion | undefined {
	const match = stableVersionPattern.exec(version);
	if (!match) return undefined;
	const parts = [Number(match[1]), Number(match[2]), Number(match[3])] as const;
	if (!parts.every(Number.isSafeInteger)) {
		throw new Error(`${version}: version exceeds the safe integer range`);
	}
	return parts;
}

function compareVersions(left: StableVersion, right: StableVersion): number {
	for (let index = 0; index < 3; index++) {
		const difference = left[index] - right[index];
		if (difference !== 0) return difference;
	}
	return 0;
}

/**
 * Resolves the version the next automated publish should use.
 *
 * With no published stable version, the manifest version is the first
 * release. Otherwise a manifest version above every published stable version
 * is an explicit minor or major bump and is kept; anything else becomes the
 * highest published stable version plus one patch. Prereleases never advance
 * the stable line.
 */
export function resolveReleaseVersion(
	manifestVersion: string,
	publishedVersions: readonly string[],
): string {
	const manifest = parseStableVersion(manifestVersion);
	if (!manifest) {
		throw new Error(
			`package.json version must be a stable X.Y.Z version, got '${manifestVersion}'`,
		);
	}

	let latest: StableVersion | undefined;
	for (const published of publishedVersions) {
		const version = parseStableVersion(published);
		if (version && (!latest || compareVersions(version, latest) > 0)) {
			latest = version;
		}
	}

	if (!latest || compareVersions(manifest, latest) > 0) return manifestVersion;
	const [major, minor, patch] = latest;
	return `${major}.${minor}.${patch + 1}`;
}

/** Lists every version of `name` on npm; an unpublished package has none. */
export async function fetchPublishedVersions(
	name: string,
	fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
	const response = await fetchImpl(
		`${registryUrl}/${encodeURIComponent(name)}`,
		{ headers: { accept: "application/vnd.npm.install-v1+json" } },
	);
	if (response.status === 404) return [];
	if (!response.ok) {
		throw new Error(
			`npm registry returned ${response.status} for '${name}'; refusing to guess the release version`,
		);
	}
	const metadata: unknown = await response.json();
	if (
		typeof metadata !== "object" ||
		metadata === null ||
		!("versions" in metadata) ||
		typeof metadata.versions !== "object" ||
		metadata.versions === null
	) {
		throw new Error(`npm registry returned no versions object for '${name}'`);
	}
	return Object.keys(metadata.versions);
}

async function main(packageRoot = defaultPackageRoot): Promise<void> {
	const manifestPath = resolve(packageRoot, "package.json");
	const manifest: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
	if (
		typeof manifest !== "object" ||
		manifest === null ||
		!("name" in manifest) ||
		typeof manifest.name !== "string" ||
		!("version" in manifest) ||
		typeof manifest.version !== "string"
	) {
		throw new Error(`${manifestPath}: name and version are required`);
	}

	const current = manifest.version;
	const next = resolveReleaseVersion(
		current,
		await fetchPublishedVersions(manifest.name),
	);
	if (next !== current) {
		manifest.version = next;
		await writeFile(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
	}
	process.stdout.write(`${manifest.name}: ${current} -> ${next}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await main();
}
