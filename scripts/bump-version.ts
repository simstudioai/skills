#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageManifestPath = resolve(packageRoot, "package.json");
const packageName = "sim-skills";
const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

interface PackageManifest extends Record<string, unknown> {
	name: string;
	version: string;
}

interface ParsedVersion {
	major: number;
	minor: number;
	patch: number;
}

function parseStableVersion(version: string, source: string): ParsedVersion {
	const match = stableVersionPattern.exec(version);
	if (!match)
		throw new Error(
			`${source} must be a stable X.Y.Z version, got '${version}'`,
		);

	const parsed = {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
	};
	if (!Number.isSafeInteger(parsed.major)) {
		throw new Error(
			`${source} major version exceeds JavaScript's safe integer range`,
		);
	}
	if (!Number.isSafeInteger(parsed.minor)) {
		throw new Error(
			`${source} minor version exceeds JavaScript's safe integer range`,
		);
	}
	if (!Number.isSafeInteger(parsed.patch)) {
		throw new Error(
			`${source} patch version exceeds JavaScript's safe integer range`,
		);
	}
	return parsed;
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
	if (left.major !== right.major) return left.major - right.major;
	if (left.minor !== right.minor) return left.minor - right.minor;
	return left.patch - right.patch;
}

function formatVersion(version: ParsedVersion): string {
	return `${version.major}.${version.minor}.${version.patch}`;
}

/** Resolves the next stable package version from the manifest and npm registry. */
export function resolveNextStableVersion(
	manifestVersion: string,
	publishedVersions: readonly string[],
): string {
	const manifest = parseStableVersion(manifestVersion, "Manifest version");
	const stableVersions = publishedVersions.flatMap((version) =>
		stableVersionPattern.test(version)
			? [parseStableVersion(version, "Published version")]
			: [],
	);

	if (stableVersions.length === 0) return formatVersion(manifest);

	const latestPublished = stableVersions.reduce((latest, version) =>
		compareVersions(version, latest) > 0 ? version : latest,
	);
	if (compareVersions(manifest, latestPublished) > 0)
		return formatVersion(manifest);
	if (latestPublished.patch === Number.MAX_SAFE_INTEGER) {
		throw new Error("Published patch version cannot be incremented safely");
	}
	return formatVersion({
		...latestPublished,
		patch: latestPublished.patch + 1,
	});
}

export function isMissingPackageError(stderr: string): boolean {
	return (
		stderr.includes("404 Not Found:") &&
		stderr.includes(`'${packageName}@latest' does not exist in this registry`)
	);
}

function commandStderr(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null || !("stderr" in error))
		return undefined;
	const stderr = error.stderr;
	if (typeof stderr === "string") return stderr;
	if (Buffer.isBuffer(stderr)) return stderr.toString("utf8");
	return undefined;
}

function publishedVersions(): string[] {
	let output: string;
	try {
		output = execFileSync(
			"bun",
			["pm", "view", packageName, "versions", "--json"],
			{
				cwd: packageRoot,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
	} catch (error) {
		const stderr = commandStderr(error);
		if (stderr && isMissingPackageError(stderr)) return [];
		throw new Error(
			`Could not read published versions for '${packageName}' from npm`,
			{
				cause: error,
			},
		);
	}

	let metadata: unknown;
	try {
		metadata = JSON.parse(output);
	} catch (error) {
		throw new Error(`npm returned invalid JSON for '${packageName}'`, {
			cause: error,
		});
	}
	if (
		!Array.isArray(metadata) ||
		metadata.some((version) => typeof version !== "string")
	) {
		throw new Error(
			`npm did not return a string version array for '${packageName}'`,
		);
	}
	return metadata;
}

function readManifest(): PackageManifest {
	const metadata: unknown = JSON.parse(
		readFileSync(packageManifestPath, "utf8"),
	);
	if (metadata === null || typeof metadata !== "object") {
		throw new Error("package.json must contain a JSON object");
	}

	const manifest = metadata as Record<string, unknown>;
	if (manifest.name !== packageName) {
		throw new Error(
			`package.json must describe '${packageName}', got '${String(manifest.name)}'`,
		);
	}
	if (typeof manifest.version !== "string") {
		throw new Error("package.json is missing a string version");
	}
	return manifest as PackageManifest;
}

function main(): void {
	const manifest = readManifest();
	const currentVersion = manifest.version;
	const nextVersion = resolveNextStableVersion(
		currentVersion,
		publishedVersions(),
	);
	manifest.version = nextVersion;
	writeFileSync(packageManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
	process.stdout.write(`${packageName}: ${currentVersion} -> ${nextVersion}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
