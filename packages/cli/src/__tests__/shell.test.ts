import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { assertSafeHost, commandFor, shellQuote } from "../shell.js";

const NASTY = [
  `a"; touch /tmp/pwned; echo "`,
  "it's $(id) `id` $HOME",
  "semi;colon && pipe | amp &",
  "new\nline",
  "",
];

describe("shellQuote", () => {
  it("round-trips arbitrary arguments through a POSIX shell", () => {
    for (const arg of NASTY) {
      const out = execFileSync("sh", ["-c", `printf %s ${shellQuote(arg)}`], { encoding: "utf8" });
      expect(out).toBe(arg);
    }
  });

  it("leaves plain arguments unquoted", () => {
    expect(shellQuote("com.example.App")).toBe("com.example.App");
    expect(shellQuote("/tmp/x.png")).toBe("/tmp/x.png");
  });
});

describe("commandFor", () => {
  it("runs locally without a shell", () => {
    expect(commandFor("", ["xcrun", "simctl", "launch", "booted", NASTY[0]!])).toEqual([
      "xcrun",
      ["simctl", "launch", "booted", NASTY[0]!],
    ]);
  });

  it("quotes every argument for the remote shell", () => {
    const [file, args] = commandFor("mac", ["xcrun", "simctl", "io", "booted", "type", NASTY[0]!]);
    expect(file).toBe("ssh");
    expect(args[0]).toBe("mac");
    // What the remote login shell would see: a single, intact argument.
    const remote = args[1]!.replace(/^xcrun /, "printf %s\\\\0 ");
    const out = execFileSync("sh", ["-c", remote], { encoding: "utf8" });
    expect(out.split("\0").slice(0, -1)).toEqual(["simctl", "io", "booted", "type", NASTY[0]!]);
  });

  it("passes ssh options before the host", () => {
    expect(commandFor("mac", ["echo", "ok"], ["-T"])).toEqual(["ssh", ["-T", "mac", "echo ok"]]);
  });

  it("rejects hosts that would be parsed as ssh options", () => {
    expect(() => commandFor("-oProxyCommand=id", ["echo"])).toThrow("Invalid host");
    expect(() => assertSafeHost("mac evil")).toThrow("Invalid host");
    expect(() => assertSafeHost("user@mac.local")).not.toThrow();
  });
});
