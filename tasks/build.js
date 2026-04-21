import ts from "npm:typescript@5.9";
import { walk } from "jsr:@std/fs@1/walk";
import { relative, dirname, join } from "jsr:@std/path@1";

const srcDir = "src";
const outDir = ".";

// 1. Bundle each .ts entry point with deno bundle (minified + sourcemaps)
const entries = [];
for await (const entry of walk(srcDir, { exts: [".ts"], match: [/(?<!\.spec|\.test)\.ts$/] })) {
  entries.push(entry.path);
}

for (const entryPath of entries) {
  const relPath = relative(srcDir, entryPath).replace(/\.ts$/, ".js");
  const outPath = join(outDir, relPath);
  await Deno.mkdir(dirname(outPath), { recursive: true });

  const cmd = new Deno.Command("deno", {
    args: ["bundle", "--minify", "--sourcemap=linked", "-o", outPath, entryPath],
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await cmd.output();
  if (code !== 0) {
    console.error(`deno bundle failed for ${entryPath}`);
    Deno.exit(1);
  }
}

// 2. Generate .d.ts declaration files using the TypeScript compiler API
const configPath = "tsconfig.json";
const configFile = ts.readConfigFile(configPath, (p) => Deno.readTextFileSync(p));
const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, ".");

const program = ts.createProgram(entries, {
  ...parsedConfig.options,
  declaration: true,
  emitDeclarationOnly: true,
  allowImportingTsExtensions: true,
  declarationDir: outDir,
  rootDir: srcDir,
  outDir: outDir,
});

const emitResult = program.emit();
const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
if (diagnostics.length > 0) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => Deno.cwd(),
    getNewLine: () => "\n",
  }));
}
