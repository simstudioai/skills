import { describe, expect, it } from "vitest";
import {
	isMissingPackageError,
	resolveNextStableVersion,
} from "./bump-version";

describe("resolveNextStableVersion", () => {
	it("uses the manifest for the first publish", () => {
		expect(resolveNextStableVersion("0.1.0", [])).toBe("0.1.0");
	});

	it("increments the highest published stable patch and ignores prereleases", () => {
		expect(
			resolveNextStableVersion("0.1.0", [
				"0.1.0",
				"0.1.1-preview.2",
				"0.0.9",
				"0.1.1-dev.3",
			]),
		).toBe("0.1.1");
	});

	it("preserves an explicitly higher manifest version", () => {
		expect(resolveNextStableVersion("1.0.0", ["0.8.2", "0.9.0"])).toBe("1.0.0");
	});

	it("advances from the registry when the manifest is stale", () => {
		expect(resolveNextStableVersion("0.1.0", ["1.2.3", "1.3.0"])).toBe("1.3.1");
	});

	it("fails on invalid manifest versions", () => {
		expect(() =>
			resolveNextStableVersion("0.2.0-preview.1", ["0.1.0"]),
		).toThrow(
			"Manifest version must be a stable X.Y.Z version, got '0.2.0-preview.1'",
		);
	});
});

describe("isMissingPackageError", () => {
	it("matches only a missing sim-skills package", () => {
		expect(
			isMissingPackageError(`
404 Not Found: https://registry.npmjs.org/sim-skills

 - 'sim-skills@latest' does not exist in this registry
`),
		).toBe(true);
		expect(isMissingPackageError("ConnectionRefused: request failed")).toBe(
			false,
		);
	});
});
