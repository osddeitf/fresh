import {
  assertSelector,
  assertTextMany,
  parseHtml,
  withFakeServe,
} from "./test_utils.ts";
import { assertEquals } from "./deps.ts";
import { createHandler } from "../server.ts";
import manifest from "./fixture/fresh.gen.ts";
import config from "./fixture/fresh.config.ts";

const handler = await createHandler(manifest, config);

// Issue: https://github.com/denoland/fresh/issues/1636
Deno.test("doesn't leak data across renderers", async () => {
  async function load(name: string) {
    const req = new Request(`http://localhost/admin/${name}`);
    const resp = await handler(req);
    const doc = parseHtml(await resp.text());

    assertSelector(doc, "#__FRSH_STATE");
    const text = doc.querySelector("#__FRSH_STATE")?.textContent!;
    const json = JSON.parse(text);
    assertEquals(json, { "v": [[{ "site": name }], []] });
  }

  const promises = [];
  for (let i = 0; i < 100; i++) {
    promises.push(load("foo"));
    promises.push(load("bar"));
  }
  await Promise.all(promises);
});

Deno.test("render headers passed to ctx.render()", async () => {
  await withFakeServe("./tests/fixture_render/main.ts", async (server) => {
    let res = await server.get("/header_arr");
    assertEquals(res.headers.get("x-foo"), "Hello world!");
    await res.body?.cancel();

    res = await server.get("/header_obj");
    assertEquals(res.headers.get("x-foo"), "Hello world!");
    await res.body?.cancel();

    res = await server.get("/header_instance");
    assertEquals(res.headers.get("x-foo"), "Hello world!");
    await res.body?.cancel();
  });
});

Deno.test("render head text nodes", async () => {
  await withFakeServe("./tests/fixture_render/main.ts", async (server) => {
    const doc = await server.getHtml("/head_style");
    assertTextMany(doc, "style", ["body { color: red }"]);
    assertEquals(doc.body.textContent, "hello");
  });
});

Deno.test("support jsx precompile", async () => {
  await withFakeServe(
    "./tests/fixture_jsx_precompile/main.ts",
    async (server) => {
      const doc = await server.getHtml("/");
      assertTextMany(doc, "h1", ["Hello World"]);
      assertTextMany(doc, ".island", ["it works"]);
    },
  );
});

Deno.test("support <Head /> with jsx precompile", async () => {
  await withFakeServe(
    "./tests/fixture_jsx_precompile/main.ts",
    async (server) => {
      const doc = await server.getHtml("/head");
      assertTextMany(doc, "h1", ["Hello World"]);
      assertTextMany(doc, "head title", ["foo"]);
    },
  );
});

Deno.test("Ensure manifest has valid specifiers", async () => {
  await withFakeServe(
    "./tests/fixture/main.ts",
    async (server) => {
      const doc = await server.getHtml("/foo.bar.baz");
      assertTextMany(doc, "p", ["it works"]);
    },
  );
});
