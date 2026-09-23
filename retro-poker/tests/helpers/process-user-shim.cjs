// tsx derives its IPC pipe name from process.geteuid() when it is available.
// Windows has no geteuid(), so tsx falls back to os.userInfo(), which can fail
// under constrained test runners before the backend process is even started.
globalThis.process.geteuid = () => 0;
