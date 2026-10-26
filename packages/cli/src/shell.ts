/**
 * Helpers for running simctl/xcrun locally or over SSH without a shell.
 *
 * Arguments are never interpolated into a local shell string. For remote
 * hosts, ssh hands the command to the remote login shell, so every argument
 * is POSIX single-quoted.
 */

/** Quote one argument for a POSIX shell. */
export function shellQuote(arg: string): string {
  if (/^[A-Za-z0-9_\/.,:=@%+-]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/** Reject hosts that ssh/scp would parse as options (e.g. -oProxyCommand=...). */
export function assertSafeHost(host: string): void {
  if (host.startsWith("-") || /\s/.test(host)) {
    throw new Error(`Invalid host: ${JSON.stringify(host)}`);
  }
}

/**
 * Build an execFile-style [file, args] pair that runs `argv` locally, or on
 * `host` via ssh when host is non-empty.
 */
export function commandFor(host: string, argv: readonly string[], sshArgs: readonly string[] = []): [string, string[]] {
  const [file, ...rest] = argv;
  if (!file) throw new Error("commandFor: empty argv");
  if (!host) return [file, rest];
  assertSafeHost(host);
  return ["ssh", [...sshArgs, host, argv.map(shellQuote).join(" ")]];
}
