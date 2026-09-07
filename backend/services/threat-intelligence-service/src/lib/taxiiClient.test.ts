import { discoverApiRoot, listCollections, pollObjects } from "./taxiiClient";

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, statusText: ok ? "OK" : "Error", json: async () => body };
}

describe("taxiiClient", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("discovers the default api root", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ title: "Test Server", default: "https://taxii.example.com/api1/" }),
    );

    const apiRoot = await discoverApiRoot("https://taxii.example.com/taxii2/");
    expect(apiRoot).toBe("https://taxii.example.com/api1/");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://taxii.example.com/taxii2/",
      expect.objectContaining({ headers: expect.objectContaining({ Accept: "application/taxii+json;version=2.1" }) }),
    );
  });

  it("falls back to the first api_root when there's no default", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ title: "Test Server", api_roots: ["https://taxii.example.com/api1/"] }),
    );

    const apiRoot = await discoverApiRoot("https://taxii.example.com/taxii2/");
    expect(apiRoot).toBe("https://taxii.example.com/api1/");
  });

  it("throws when no api roots are advertised", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ title: "Test Server" }));
    await expect(discoverApiRoot("https://taxii.example.com/taxii2/")).rejects.toThrow(/advertised no API roots/);
  });

  it("sends basic auth headers when configured", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ collections: [] }));

    await listCollections("https://taxii.example.com/api1/", {
      authType: "basic",
      username: "user",
      password: "pass",
    });

    const expectedAuth = `Basic ${Buffer.from("user:pass").toString("base64")}`;
    expect(global.fetch).toHaveBeenCalledWith(
      "https://taxii.example.com/api1/collections/",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expectedAuth }) }),
    );
  });

  it("builds added_after and next query params for pollObjects", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ objects: [], more: false }));

    await pollObjects(
      "https://taxii.example.com/api1/",
      "collection-1",
      { addedAfter: new Date("2024-01-01T00:00:00.000Z"), next: "cursor-abc", limit: 100 },
    );

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("collections/collection-1/objects/");
    expect(calledUrl).toContain("added_after=2024-01-01T00%3A00%3A00.000Z");
    expect(calledUrl).toContain("next=cursor-abc");
    expect(calledUrl).toContain("limit=100");
  });

  it("assembles a paginated poll across multiple pages", async () => {
    const page1 = jsonResponse({ objects: [{ id: "indicator--1", type: "indicator" }], more: true, next: "page2" });
    const page2 = jsonResponse({ objects: [{ id: "indicator--2", type: "indicator" }], more: false });
    (global.fetch as jest.Mock).mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

    const first = await pollObjects("https://taxii.example.com/api1/", "collection-1", {});
    expect(first.more).toBe(true);
    expect(first.next).toBe("page2");

    const second = await pollObjects("https://taxii.example.com/api1/", "collection-1", { next: first.next });
    expect(second.more).toBe(false);
    expect(second.objects).toHaveLength(1);
  });

  it("throws on a non-ok response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({}, false));
    await expect(listCollections("https://taxii.example.com/api1/")).rejects.toThrow(/failed: 500/);
  });
});
