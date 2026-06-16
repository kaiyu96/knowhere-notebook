// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { workspaceClient } from "@/domains/workspace/client";
import { ChatMessageList } from "./chat-message-list";

vi.mock("@/domains/workspace/client", () => ({
  workspaceClient: {
    createChatDiagram: vi.fn(),
  },
}));

describe("ChatMessageList", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    vi.spyOn(window.HTMLElement.prototype, "offsetHeight", "get")
      .mockImplementation(function getOffsetHeight(this: HTMLElement): number {
        if (this.hasAttribute("data-radix-scroll-area-viewport")) return 720;
        if (this.hasAttribute("data-index")) return 160;
        return 1;
      });
    vi.spyOn(window.HTMLElement.prototype, "offsetWidth", "get")
      .mockImplementation((): number => 720);
    vi.mocked(workspaceClient.createChatDiagram).mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders assistant citations using Notebook source labels", () => {
    render(
      React.createElement(ChatMessageList, {
        messages: [
          {
            id: "assistant_1",
            role: "assistant",
            content: "The deadline is Monday.",
            citations: [
              {
                chunkType: "text",
                score: 0.9,
                source: {
                  documentId: "doc_1",
                  sourceFileName: "document-CFxAaNTRUliEnWOokpI66xfj7JJkad.pdf",
                  sectionPath: "Root",
                },
              },
            ],
          },
        ],
        sourceTitlesByDocumentId: {
          doc_1: "Syllabus.pdf",
        },
      }),
    );

    expect(
      screen.getByRole("button", { name: "Open source Syllabus.pdf" }),
    ).toBeTruthy();
  });

  it("turns inline source text into clickable citation chips", async () => {
    const user = userEvent.setup();
    const onCitationClick = vi.fn();
    const citation = {
      chunkType: "text",
      score: 0.9,
      source: {
        documentId: "doc_1",
        sourceFileName: "syllabus.pdf",
        sectionPath: "Schedule",
      },
    } as const;

    render(
      React.createElement(ChatMessageList, {
        messages: [
          {
            id: "assistant_1",
            role: "assistant",
            content: "The deadline is Monday [Syllabus.pdf / Schedule].",
            citations: [citation],
          },
        ],
        sourceTitlesByDocumentId: {
          doc_1: "Syllabus.pdf",
        },
        onCitationClick,
      }),
    );

    const citationChip = screen.getByRole("button", {
      name: "Open source Syllabus.pdf · Schedule",
    });
    expect(citationChip.textContent).toContain("Syllabus.pdf");
    expect(citationChip.className).toContain("max-w-[250px]");
    expect(citationChip.className).toContain("rounded-full");
    expect(screen.queryByText("Sources used")).toBeNull();

    await user.click(citationChip);

    expect(onCitationClick).toHaveBeenCalledWith(citation, "assistant_1:0");
  });

  it("renders image citations as viewable image attachments", () => {
    render(
      React.createElement(ChatMessageList, {
        messages: [
          {
            id: "assistant_1",
            role: "assistant",
            content: "Here is the launch image.",
            citations: [
              {
                chunkType: "image",
                score: 0.9,
                assetUrl: "https://blob.example/images/launch.jpg",
                source: {
                  documentId: "doc_1",
                  sourceFileName: "spacex-s1.pdf",
                  sectionPath: "Assets / images / launch.jpg",
                },
              },
            ],
          },
        ],
      }),
    );

    const image = screen.getByRole("img", {
      name: "spacex-s1.pdf · Assets / images / launch.jpg",
    });
    expect(image.getAttribute("src")).toBe(
      "https://blob.example/images/launch.jpg",
    );
    expect(
      screen.queryByRole("link", {
        name: "https://blob.example/images/launch.jpg",
      }),
    ).toBeNull();
    expect(
      screen.queryByText("https://blob.example/images/launch.jpg"),
    ).toBeNull();
  });

  it("renders assistant markdown with GitHub-flavored tables", () => {
    render(
      React.createElement(ChatMessageList, {
        messages: [
          {
            id: "assistant_1",
            role: "assistant",
            content:
              "### Summary\n\n- **Deadline:** Monday\n\n| Item | Status |\n| --- | --- |\n| Draft | Ready |",
          },
        ],
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Summary", level: 3 }),
    ).toBeTruthy();
    expect(screen.getByRole("listitem").textContent).toContain("Deadline:");
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Item" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "Ready" })).toBeTruthy();
  });

  it("creates and renders a diagram for an assistant answer", async () => {
    const user = userEvent.setup();
    vi.mocked(workspaceClient.createChatDiagram).mockResolvedValue({
      diagram: {
        type: "bar",
        source: "chart-visualization-skills",
        title: "Revenue by Segment",
        axisYTitle: "Revenue",
        data: [
          { category: "Cloud", value: 42 },
          { category: "Ads", value: 28 },
        ],
      },
    });

    render(
      React.createElement(ChatMessageList, {
        messages: [
          {
            id: "assistant_1",
            role: "assistant",
            content: "Cloud revenue was 42 and Ads revenue was 28.",
          },
        ],
      }),
    );

    await user.click(screen.getByRole("button", { name: "Create diagram" }));

    expect(workspaceClient.createChatDiagram).toHaveBeenCalledWith({
      answer: "Cloud revenue was 42 and Ads revenue was 28.",
    });
    expect(await screen.findByText("Revenue by Segment")).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "Revenue by Segment" }),
    ).toBeTruthy();
  });

  it("keeps user markdown-looking text literal", () => {
    render(
      React.createElement(ChatMessageList, {
        messages: [
          {
            id: "user_1",
            role: "user",
            content: "**Do not render this as bold**",
          },
        ],
      }),
    );

    expect(screen.getByText("**Do not render this as bold**")).toBeTruthy();
    expect(screen.queryByText("Do not render this as bold")).toBeNull();
  });

  it("skips assistant inline HTML while rendering markdown text", () => {
    render(
      React.createElement(ChatMessageList, {
        messages: [
          {
            id: "assistant_1",
            role: "assistant",
            content: "Visible **text** <img src=\"x\" alt=\"hidden image\" />",
          },
        ],
      }),
    );

    expect(screen.getByText("text")).toBeTruthy();
    expect(screen.queryByAltText("hidden image")).toBeNull();
  });

  it("does not hide image cards when source links dedupe the same section", () => {
    render(
      React.createElement(ChatMessageList, {
        messages: [
          {
            id: "assistant_1",
            role: "assistant",
            content: "这里是相关身份证明图片。",
            citations: [
              {
                chunkType: "text",
                score: 0.9,
                source: {
                  documentId: "doc_1",
                  sourceFileName: "商务标文件.pdf",
                  sectionPath: "二、法定代表人身份证明",
                },
              },
              {
                chunkType: "image",
                score: 0.9,
                assetUrl: "https://blob.example/images/image-6-id-front.jpg",
                source: {
                  documentId: "doc_1",
                  sourceFileName: "商务标文件.pdf",
                  sectionPath: "二、法定代表人身份证明",
                },
              },
            ],
          },
        ],
      }),
    );

    expect(
      screen.getByRole("img", {
        name: "商务标文件.pdf · 二、法定代表人身份证明",
      }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("button", {
        name: "Open source 商务标文件.pdf · 二、法定代表人身份证明",
      }),
    ).toHaveLength(1);
  });

  it("shows thinking progress after existing messages while sending", () => {
    render(
      React.createElement(ChatMessageList, {
        isSending: true,
        messages: [
          {
            id: "user_1",
            role: "user",
            content: "What changed?",
          },
        ],
      }),
    );

    expect(screen.getByRole("status", { name: "Thinking" })).toBeTruthy();
    expect(
      within(screen.getByTestId("chat-scroll")).getByText("What changed?"),
    ).toBeTruthy();
  });
});
