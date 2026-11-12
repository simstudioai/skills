import { describe, expect, it } from "vitest";
import {
	fetchPublishedVersions,
	resolveReleaseVersion,
} from "./resolve-release-version";

describe("resolveReleaseVersion", () => {
	it("keeps the manifest version when nothing stable is published", () => {
		expect(resolveReleaseVersion("0.1.1", [])).toBe("0.1.1");
		expect(resolveReleaseVersion("0.1.1", ["0.1.0-preview.3"])).toBe("0.1.1");
	});

	it("keeps a manifest version ahead of the published line", () => {
		expect(resolveReleaseVersion("0.3.0", ["0.2.9", "0.2.10"])).toBe("0.3.0");
	});

	it("bumps the highest published patch when the manifest is behind or equal", () => {
		expect(resolveReleaseVersion("0.1.1", ["0.1.1", "0.2.4", "0.2.10"])).toBe(
			"0.2.11",
		);
		expect(resolveReleaseVersion("0.2.10", ["0.2.10"])).toBe("0.2.11");
	});

	it("ignores prereleases above the stable line", () => {
		expect(
			resolveReleaseVersion("0.2.0", [
				"0.2.0",
				"0.3.0-preview.1",
				"1.0.0-rc.1",
			]),
		).toBe("0.2.1");
	});

	it("rejects a non-stable manifest version", () => {
		expect(() => resolveReleaseVersion("0.2.0-preview.1", [])).toThrow(
			"stable X.Y.Z",
		);
	});
});

describe("fetchPublishedVersions", () => {
	const respond = (status: number, body: unknown): typeof fetch =>
		(async () =>
			new Response(JSON.stringify(body), { status })) as typeof fetch;

	it("treats a package npm has never seen as unpublished", async () => {
		await expect(
			fetchPublishedVersions(
				"sim-skills",
				respond(404, { error: "Not found" }),
			),
		).resolves.toEqual([]);
	});

	it("fails instead of guessing when the registry errors", async () => {
		await expect(
			fetchPublishedVersions("sim-skills", respond(503, {})),
		).rejects.toThrow("503");
	});

	it("returns the published version keys", async () => {
		await expect(
			fetchPublishedVersions(
				"sim-skills",
				respond(200, { versions: { "0.1.1": {}, "0.1.2": {} } }),
			),
		).resolves.toEqual(["0.1.1", "0.1.2"]);
	});
});
