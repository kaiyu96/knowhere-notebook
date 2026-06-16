"use client";

import {
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { type VirtualItem } from "@tanstack/react-virtual";
import { BarChart3, ImageIcon, MessageCircle } from "lucide-react";
import ReactMarkdown, {
  defaultUrlTransform,
  type Components,
} from "react-markdown";
import remarkGfm from "remark-gfm";

import { ChatDiagramCard } from "@/components/chat-diagram-card";
import { useChatMessageListWorkflow } from "@/components/chat-message-list-workflow";
import { chatPanelModel } from "@/components/chat-panel-model";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  ChatCitationView,
  ChatMessageView,
} from "@/domains/chat/types";
import type { ChatDiagramChartSpec } from "@/domains/chat/diagram";
import { workspaceClient } from "@/domains/workspace/client";

type DisplayCitation = {
  readonly citation: ChatCitationView;
  readonly citationId: string;
  readonly label: string;
};

type DisplayImageCitation = DisplayCitation & {
  readonly assetUrl: string;
};

type InlineCitationMarkdown = {
  readonly content: string;
  readonly usedCitationIds: ReadonlySet<string>;
};

type ChatDiagramState =
  | {
      readonly status: "idle";
    }
  | {
      readonly status: "loading";
    }
  | {
      readonly status: "ready";
      readonly diagram: ChatDiagramChartSpec;
    }
  | {
      readonly status: "empty";
      readonly reason: string;
    }
  | {
      readonly status: "error";
      readonly message: string;
    };

const idleDiagramState: ChatDiagramState = { status: "idle" };

const assistantMarkdownComponents: Components = {
  p: ({ children }) => (
    <p className="whitespace-pre-wrap break-words">{children}</p>
  ),
};

export type ChatMessageListProps = {
  readonly isDisabled?: boolean;
  readonly isSending?: boolean;
  readonly messages?: readonly ChatMessageView[];
  readonly needsLogin?: boolean;
  readonly onCitationClick?: (
    citation: ChatCitationView,
    citationId: string,
  ) => void;
  readonly pendingCitationId?: string | null;
  readonly pendingStatusText?: string | null;
  readonly sourceTitlesByDocumentId?: Readonly<Record<string, string>>;
};

export function ChatMessageList({
  isDisabled = false,
  isSending = false,
  messages = [],
  needsLogin = false,
  onCitationClick,
  pendingCitationId = null,
  pendingStatusText = null,
  sourceTitlesByDocumentId = {},
}: ChatMessageListProps): ReactElement {
  const [diagramStatesByMessageId, setDiagramStatesByMessageId] = useState<
    Readonly<Record<string, ChatDiagramState>>
  >({});
  const {
    getVirtualMessage,
    isThinkingVirtualItem,
    measureElement,
    messageRowCount,
    totalHeight,
    viewportRef,
    virtualItems,
  } = useChatMessageListWorkflow({ isSending, messages });

  async function handleCreateDiagram(message: ChatMessageView): Promise<void> {
    if (diagramStatesByMessageId[message.id]?.status === "loading") return;

    setDiagramStatesByMessageId((current) => ({
      ...current,
      [message.id]: { status: "loading" },
    }));

    try {
      const response = await workspaceClient.createChatDiagram({
        answer: message.content,
      });
      const diagram = response.diagram;
      if (!diagram) {
        setDiagramStatesByMessageId((current) => ({
          ...current,
          [message.id]: {
            status: "error",
            message: response.message ?? "Diagram could not be created.",
          },
        }));
        return;
      }
      if (diagram.type === "none") {
        setDiagramStatesByMessageId((current) => ({
          ...current,
          [message.id]: {
            status: "empty",
            reason: diagram.reason,
          },
        }));
        return;
      }

      setDiagramStatesByMessageId((current) => ({
        ...current,
        [message.id]: {
          status: "ready",
          diagram,
        },
      }));
    } catch {
      setDiagramStatesByMessageId((current) => ({
        ...current,
        [message.id]: {
          status: "error",
          message: "Diagram could not be created.",
        },
      }));
    }
  }

  return (
    <ScrollArea
      data-testid="chat-scroll"
      className="flex min-w-0 flex-1 flex-col overflow-x-hidden p-3 sm:p-4"
      viewportRef={viewportRef}
    >
      {messageRowCount === 0 ? (
        <EmptyChat disabled={isDisabled} needsLogin={needsLogin} />
      ) : (
        <div className="relative mt-auto min-w-0" style={{ height: totalHeight }}>
          {virtualItems.map((virtualItem) =>
            isThinkingVirtualItem(virtualItem) ? (
              <VirtualThinkingRow
                key={virtualItem.key}
                virtualItem={virtualItem}
                measureElement={measureElement}
                pendingStatusText={pendingStatusText}
              />
            ) : (
              <VirtualMessageRow
                key={virtualItem.key}
                virtualItem={virtualItem}
                message={getVirtualMessage(virtualItem)}
                measureElement={measureElement}
                diagramState={
                  diagramStatesByMessageId[getVirtualMessage(virtualItem)?.id ?? ""]
                }
                onCreateDiagram={handleCreateDiagram}
                onCitationClick={onCitationClick}
                pendingCitationId={pendingCitationId}
                sourceTitlesByDocumentId={sourceTitlesByDocumentId}
              />
            ),
          )}
        </div>
      )}
    </ScrollArea>
  );
}

function VirtualThinkingRow({
  virtualItem,
  measureElement,
  pendingStatusText,
}: {
  readonly virtualItem: VirtualItem;
  readonly measureElement: (node: HTMLDivElement | null) => void;
  readonly pendingStatusText?: string | null;
}): ReactElement {
  const rowStyle: CSSProperties = {
    position: "absolute",
    transform: `translateY(${virtualItem.start}px)`,
    width: "100%",
  };

  return (
    <div
      ref={measureElement}
      data-index={virtualItem.index}
      style={rowStyle}
      className="min-w-0 pb-4 sm:pb-5"
    >
      <ThinkingProgressBubble pendingStatusText={pendingStatusText} />
    </div>
  );
}

function ThinkingProgressBubble({
  pendingStatusText,
}: {
  readonly pendingStatusText?: string | null;
}): ReactElement {
  return (
    <div className="flex min-w-0 flex-col items-start">
      <div
        role="status"
        aria-label="Thinking"
        className="inline-flex max-w-[92%] items-center gap-2 rounded-2xl rounded-tl-sm border border-border/70 bg-card px-3 py-2.5 text-sm text-muted-foreground shadow-xs sm:max-w-[90%] sm:px-4 sm:py-3"
      >
        <span className="font-medium text-foreground">
          {pendingStatusText ?? "Thinking"}
        </span>
        <span aria-hidden="true" className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-primary/60 animate-pulse" />
          <span className="size-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:150ms]" />
          <span className="size-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  );
}

function VirtualMessageRow({
  diagramState,
  virtualItem,
  message,
  measureElement,
  onCreateDiagram,
  onCitationClick,
  pendingCitationId,
  sourceTitlesByDocumentId,
}: {
  readonly diagramState?: ChatDiagramState;
  readonly virtualItem: VirtualItem;
  readonly message: ChatMessageView | undefined;
  readonly measureElement: (node: HTMLDivElement | null) => void;
  readonly onCreateDiagram: (message: ChatMessageView) => void;
  readonly onCitationClick?: (
    citation: ChatCitationView,
    citationId: string,
  ) => void;
  readonly pendingCitationId?: string | null;
  readonly sourceTitlesByDocumentId: Readonly<Record<string, string>>;
}): ReactElement | null {
  if (!message) {
    return null;
  }

  const rowStyle: CSSProperties = {
    position: "absolute",
    transform: `translateY(${virtualItem.start}px)`,
    width: "100%",
  };

  return (
    <div
      ref={measureElement}
      data-index={virtualItem.index}
      style={rowStyle}
      className="min-w-0 pb-4 sm:pb-5"
    >
      <MessageBubble
        diagramState={diagramState ?? idleDiagramState}
        message={message}
        onCreateDiagram={onCreateDiagram}
        onCitationClick={onCitationClick}
        pendingCitationId={pendingCitationId}
        sourceTitlesByDocumentId={sourceTitlesByDocumentId}
      />
    </div>
  );
}

function EmptyChat({
  disabled,
  needsLogin,
}: {
  readonly disabled: boolean;
  readonly needsLogin: boolean;
}): ReactElement {
  return (
    <div className="m-auto mt-16 flex h-full w-full max-w-sm flex-col items-center justify-center px-3 pb-8 text-center sm:mt-24 sm:px-4 sm:pb-10">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-border/70 bg-background text-primary/50 shadow-xs">
        <MessageCircle className="size-7" />
      </div>
      <h3 className="mb-1.5 text-sm font-bold text-foreground">
        How may I assist you today?
      </h3>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {needsLogin
          ? "Log in to start asking questions about your sources."
          : disabled
            ? "Upload a document to start asking questions."
            : "Ask anything about your sources. Answers include source links when Notebook finds support."}
      </p>
    </div>
  );
}

function MessageBubble({
  diagramState,
  message,
  onCreateDiagram,
  onCitationClick,
  pendingCitationId,
  sourceTitlesByDocumentId,
}: {
  readonly diagramState: ChatDiagramState;
  readonly message: ChatMessageView;
  readonly onCreateDiagram: (message: ChatMessageView) => void;
  readonly onCitationClick?: (
    citation: ChatCitationView,
    citationId: string,
  ) => void;
  readonly pendingCitationId?: string | null;
  readonly sourceTitlesByDocumentId: Readonly<Record<string, string>>;
}): ReactElement {
  if (message.role === "user") {
    return (
      <div className="flex min-w-0 flex-col items-end">
        <div className="max-w-[85%] break-words rounded-2xl rounded-tr-sm bg-muted px-3 py-2.5 text-sm text-foreground shadow-xs sm:px-4 sm:py-3">
          {message.content}
        </div>
      </div>
    );
  }

  const displayCitations = getDisplayCitations(
    message,
    sourceTitlesByDocumentId,
  );
  const displayImageCitations = getDisplayImageCitations(
    message,
    sourceTitlesByDocumentId,
  );
  const inlineCitationMarkdown = buildInlineCitationMarkdown(
    message.content,
    displayCitations,
  );
  const sourceListCitations = displayCitations.filter(
    ({ citationId }): boolean =>
      !inlineCitationMarkdown.usedCitationIds.has(citationId),
  );
  const sourceListLabel =
    inlineCitationMarkdown.usedCitationIds.size > 0
      ? "More sources"
      : "Sources used";

  return (
    <div className="flex min-w-0 flex-col items-start">
      <div className="max-w-[92%] overflow-hidden rounded-2xl rounded-tl-sm border border-border/70 bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground shadow-xs sm:max-w-[90%] sm:px-4 sm:py-3">
        <TooltipProvider delayDuration={150}>
          <AssistantMessageContent
            content={inlineCitationMarkdown.content}
            displayCitations={displayCitations}
            onCitationClick={onCitationClick}
            pendingCitationId={pendingCitationId}
          />
        </TooltipProvider>
        <AssistantDiagram
          message={message}
          state={diagramState}
          onCreateDiagram={onCreateDiagram}
        />
        {displayImageCitations.length > 0 && (
          <div className="mt-3 border-t border-border/70 pt-2.5">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <ImageIcon className="size-3" />
              Images
            </p>
            <div className="grid gap-2">
              {displayImageCitations.map(({ assetUrl, citationId, label }) => (
                <figure
                  key={`${citationId}-image`}
                  className="overflow-hidden rounded-lg border border-border bg-muted/25"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- Chat image citation dimensions are not known before render. */}
                  <img
                    src={assetUrl}
                    alt={label}
                    className="max-h-64 w-full object-contain"
                  />
                  <figcaption className="border-t border-border/70 bg-background/80 px-2.5 py-2">
                    <span className="block break-words text-[11px] font-semibold text-foreground">
                      {label}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
        {sourceListCitations.length > 0 && (
          <div className="mt-3 border-t border-border/70 pt-2.5">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {sourceListLabel}
            </p>
            <TooltipProvider delayDuration={150}>
              <div className="flex flex-wrap gap-1.5">
                {sourceListCitations.map(({ citation, citationId, label }) => (
                  <CitationChip
                    key={citationId}
                    citation={citation}
                    citationId={citationId}
                    label={label}
                    text={getCitationChipText(label)}
                    isPending={citationId === pendingCitationId}
                    onCitationClick={onCitationClick}
                  />
                ))}
              </div>
            </TooltipProvider>
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantMessageContent({
  content,
  displayCitations,
  onCitationClick,
  pendingCitationId,
}: {
  readonly content: string;
  readonly displayCitations: readonly DisplayCitation[];
  readonly onCitationClick?: (
    citation: ChatCitationView,
    citationId: string,
  ) => void;
  readonly pendingCitationId?: string | null;
}): ReactElement {
  const inlineCitationsByHref = new Map(
    displayCitations.map((displayCitation): readonly [string, DisplayCitation] => [
      getCitationHref(displayCitation.citationId),
      displayCitation,
    ]),
  );
  const markdownComponents: Components = {
    ...assistantMarkdownComponents,
    a: ({ href, children }) => {
      const displayCitation = href ? inlineCitationsByHref.get(href) : undefined;
      if (!displayCitation) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
          >
            {children}
          </a>
        );
      }

      return (
        <CitationChip
          citation={displayCitation.citation}
          citationId={displayCitation.citationId}
          label={displayCitation.label}
          text={children}
          isPending={displayCitation.citationId === pendingCitationId}
          onCitationClick={onCitationClick}
        />
      );
    },
  };

  return (
    <div className="chat-markdown-content min-w-0 max-w-full overflow-x-auto">
      <ReactMarkdown
        components={markdownComponents}
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={transformAssistantMarkdownUrl}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function transformAssistantMarkdownUrl(value: string): string {
  return value.startsWith("citation://") ? value : defaultUrlTransform(value);
}

function CitationChip({
  citation,
  citationId,
  isPending,
  label,
  onCitationClick,
  text,
}: {
  readonly citation: ChatCitationView;
  readonly citationId: string;
  readonly isPending: boolean;
  readonly label: string;
  readonly onCitationClick?: (
    citation: ChatCitationView,
    citationId: string,
  ) => void;
  readonly text: ReactNode;
}): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={!onCitationClick || isPending}
          onClick={() => onCitationClick?.(citation, citationId)}
          className="inline-flex max-w-[250px] cursor-pointer items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 align-baseline text-[11px] font-semibold leading-4 text-primary transition-colors hover:border-primary/45 hover:bg-primary/15 hover:text-primary/80 focus:outline-none focus:ring-4 focus:ring-ring/15 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-wait disabled:opacity-75"
          aria-label={`Open source ${label}`}
        >
          {isPending && <Spinner className="size-3" />}
          <span className="min-w-0 truncate">{text}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function AssistantDiagram({
  message,
  onCreateDiagram,
  state,
}: {
  readonly message: ChatMessageView;
  readonly onCreateDiagram: (message: ChatMessageView) => void;
  readonly state: ChatDiagramState;
}): ReactElement | null {
  if (message.content.trim().length === 0) return null;

  return (
    <div className="mt-3 border-t border-border/70 pt-2.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={state.status === "loading"}
        onClick={() => onCreateDiagram(message)}
        className="h-7 gap-1.5 rounded-full px-3 text-[11px] font-semibold"
        aria-label="Create diagram"
      >
        {state.status === "loading" ? (
          <Spinner className="size-3.5" />
        ) : (
          <BarChart3 className="size-3.5" />
        )}
        <span>{state.status === "loading" ? "Creating" : "Create diagram"}</span>
      </Button>
      {state.status === "ready" && (
        <ChatDiagramCard diagram={state.diagram} />
      )}
      {state.status === "empty" && (
        <p className="mt-2 text-xs text-muted-foreground">{state.reason}</p>
      )}
      {state.status === "error" && (
        <p className="mt-2 text-xs text-destructive">{state.message}</p>
      )}
    </div>
  );
}

function buildInlineCitationMarkdown(
  content: string,
  displayCitations: readonly DisplayCitation[],
): InlineCitationMarkdown {
  const usedCitationIds = new Set<string>();
  let rewrittenContent = content;

  for (const [index, displayCitation] of displayCitations.entries()) {
    const replacement = `[${escapeMarkdownLinkText(
      getCitationChipText(displayCitation.label),
    )}](${getCitationHref(displayCitation.citationId)})`;

    for (const token of getInlineCitationTokens(displayCitation, index)) {
      if (!rewrittenContent.includes(token)) continue;

      rewrittenContent = rewrittenContent.replaceAll(token, replacement);
      usedCitationIds.add(displayCitation.citationId);
    }
  }

  return {
    content: rewrittenContent,
    usedCitationIds,
  };
}

function getInlineCitationTokens(
  displayCitation: DisplayCitation,
  index: number,
): readonly string[] {
  const label = displayCitation.label;
  const slashLabel = label.replace(/\s+·\s+/gu, " / ");
  const sourceName = getCitationChipText(label);
  const sectionPath = getTrimmedCitationField(
    displayCitation.citation.source.sectionPath,
  );
  const description = getTrimmedCitationField(displayCitation.citation.description);
  const citationNumber = index + 1;
  const tokens = [
    `[${label}]`,
    `[${slashLabel}]`,
    `[Source ${citationNumber}: ${label}]`,
    `[Source ${citationNumber}: ${slashLabel}]`,
    sectionPath ? `[${sourceName} / ${sectionPath}]` : null,
    description ? `[${sourceName} / ${description}]` : null,
  ];

  return Array.from(
    new Set(tokens.filter((token): token is string => Boolean(token))),
  ).sort((left, right): number => right.length - left.length);
}

function getCitationChipText(label: string): string {
  const [sourceName] = label.split(/\s+·\s+/u);
  const normalized = sourceName?.trim();
  return normalized && normalized.length > 0 ? normalized : label;
}

function getCitationHref(citationId: string): string {
  return `citation://${encodeURIComponent(citationId)}`;
}

function escapeMarkdownLinkText(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/\]/gu, "\\]");
}

function getDisplayCitations(
  message: ChatMessageView,
  sourceTitlesByDocumentId: Readonly<Record<string, string>>,
): readonly DisplayCitation[] {
  const seenKeys = new Set<string>();
  const displayCitations: DisplayCitation[] = [];

  for (const [index, citation] of (message.citations ?? []).entries()) {
    const label = chatPanelModel.getCitationLabel(
      citation,
      sourceTitlesByDocumentId,
    );
    const key = getCitationDisplayKey(citation, label);
    if (seenKeys.has(key)) continue;

    seenKeys.add(key);
    displayCitations.push({
      citation,
      citationId: chatPanelModel.getCitationId(message.id, index),
      label,
    });
  }

  return displayCitations;
}

function getDisplayImageCitations(
  message: ChatMessageView,
  sourceTitlesByDocumentId: Readonly<Record<string, string>>,
): readonly DisplayImageCitation[] {
  const seenAssetUrls = new Set<string>();
  const imageCitations: DisplayImageCitation[] = [];

  for (const [index, citation] of (message.citations ?? []).entries()) {
    const assetUrl = getTrimmedCitationField(citation.assetUrl);
    if (!assetUrl || !isImageCitation(citation, assetUrl)) continue;
    if (seenAssetUrls.has(assetUrl)) continue;

    seenAssetUrls.add(assetUrl);
    imageCitations.push({
      citation,
      citationId: chatPanelModel.getCitationId(message.id, index),
      label: chatPanelModel.getCitationLabel(citation, sourceTitlesByDocumentId),
      assetUrl,
    });
  }

  return imageCitations;
}

function isImageCitation(
  citation: ChatCitationView,
  assetUrl: string,
): boolean {
  return (
    citation.chunkType.toLowerCase() === "image" ||
    hasImageFileExtension(assetUrl)
  );
}

function hasImageFileExtension(assetUrl: string): boolean {
  const pathname = getUrlPathname(assetUrl).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].some(
    (extension) => pathname.endsWith(extension),
  );
}

function getUrlPathname(assetUrl: string): string {
  try {
    return new URL(assetUrl).pathname;
  } catch {
    return assetUrl.split("?")[0] ?? assetUrl;
  }
}

function getCitationDisplayKey(
  citation: ChatCitationView,
  label: string,
): string {
  const documentId = getTrimmedCitationField(citation.source.documentId);
  if (documentId) {
    return joinCitationDisplayKeyParts(["document", documentId, label]);
  }

  return joinCitationDisplayKeyParts([
    "fallback",
    getTrimmedCitationField(citation.source.sourceFileName) ?? "",
    getTrimmedCitationField(citation.source.sectionPath) ?? "",
    getTrimmedCitationField(citation.description) ?? "",
    label,
  ]);
}

function getTrimmedCitationField(value: string | null | undefined): string | null {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function joinCitationDisplayKeyParts(parts: readonly string[]): string {
  return parts
    .map((part: string): string => `${part.length}:${part}`)
    .join("|");
}
