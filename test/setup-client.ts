// oxlint-disable-next-line import/no-namespace
import * as matchers from "@testing-library/jest-dom/matchers";
import { beforeAll, expect } from "vite-plus/test";

beforeAll(() => {
	expect.extend(matchers);
});
