// oxlint-disable-next-line import/no-namespace
import * as matchers from "@testing-library/jest-dom/matchers";
import { beforeAll, expect } from "vite-plus/test";

// oxlint-disable-next-line vitest/require-top-level-describe
beforeAll(() => {
	expect.extend(matchers);
});
