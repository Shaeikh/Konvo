"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Bubble,
  BubbleContent,
  BubbleGroup,
  BubbleReactions,
} from "@/components/ui/bubble";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
  MessageComponent,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message";
import { ModeToggle } from "@/components/ModeToggle";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";

import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { socket } from "@/lib/socket";
import { authClient } from "@/lib/auth-client";
import { v4 as uuidv4, v7 as uuidv7 } from "uuid";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardPasteIcon,
  CopyIcon,
  Edit,
  EditIcon,
  MoreVertical,
  RefreshCcw,
  RotateCcwIcon,
  ScissorsIcon,
  TrashIcon,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Badge } from "@/components/ui/badge";
import { flushSync } from "react-dom";
import { Spinner } from "@/components/ui/spinner";
import { MorphingRing } from "@/components/ui/morphing-ring";
import { TripleDotSpinner } from "@/components/ui/triple-dot-spinner";
import { PreviewCard } from "@base-ui/react";
import { toast } from "sonner";

interface MessageInputProps {
  message: string | "";
  disabled?: boolean;
  onMessageChange: (message: string | "") => void;
  onMessageSend: () => void;
}

interface RoomProps {
  name: string;
  onRoomChange: (name: string) => void;
  onRoomJoin: (name: string) => void;
  collapsed?: boolean;
  active?: boolean;
}

type Message = {
  user: User;
  room: string;
  type: "normal" | "system";
  id: string | undefined;
  content: string;
  createdAt: number;
};

interface User {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null | undefined;
}

interface MessageContainerProps {
  messages: Message[];
  handleMessages: (updater: (prev: Message[]) => Message[]) => void;
  user: User;
  typingUsers: User[];
}

interface ChatUIProps {
  serverSession: typeof authClient.$Infer.Session;
}

export function MessageInput({
  message,
  onMessageChange,
  onMessageSend,
  disabled = true,
}: MessageInputProps) {
  return (
    <FieldGroup className="w-full">
      <Field>
        <InputGroup className="backdrop-blur-3xl">
          <Input
            autoComplete="off"
            disabled={disabled}
            className="text-lg! px-4 disabled:cursor-not-allowed disabled:pointer-events-auto"
            placeholder="Write a message"
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onMessageSend();
              }
            }}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              onClick={onMessageSend}
              variant="secondary"
              size="sm"
              className="ml-auto disabled:cursor-not-allowed disabled:hover:bg-secondary disabled:pointer-events-auto"
              disabled={disabled}
            >
              Send
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Field>
    </FieldGroup>
  );
}

function Room({
  name,
  onRoomChange,
  onRoomJoin,
  collapsed = false,
  active = false,
}: RoomProps) {
  return (
    <button
      onClick={() => {
        onRoomChange(name);
        onRoomJoin(name);
      }}
      title={collapsed ? name : undefined}
      className={cn(
        "flex w-full items-center rounded-lg text-sm transition-colors",
        "hover:bg-muted hover:text-foreground",
        collapsed ? "justify-center px-2 py-3" : "px-3 py-2.5",
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          active ? "bg-blue-400" : "bg-input",
        )}
      />

      {!collapsed && <span className="ml-3 truncate">{name}</span>}
    </button>
  );
}

function MessageContainer({
  messages,
  handleMessages,
  user,
  typingUsers,
}: MessageContainerProps) {
  interface Timestamps {
    messageID: string | undefined;
    time: string;
  }
  interface ShowMore {
    messageID: string | undefined;
    show: boolean;
  }
  const [timestamps, setTimestamps] = useState<Timestamps>();
  const [focusedMessageId, setFocusedMessageId] = useState<string | undefined>(
    "",
  );
  const [showMore, setShowMore] = useState<ShowMore>();
  const [showMoreOpened, setShowMoreOpened] = useState<boolean>();

  let hoverTimer: any;
  const handleMouseEnterMessage = (message: Message) => {
    clearTimeout(hoverTimer);
    setShowMore({ messageID: message.id, show: true });
    hoverTimer = setTimeout(() => {
      setTimestamps({
        messageID: message.id,
        time: new Date(message.createdAt).toLocaleTimeString(undefined, {
          timeStyle: "short",
        }),
      });
    }, 500);
  };

  const handleMouseLeaveMessage = () => {
    clearTimeout(hoverTimer);
    setShowMore(undefined);
    setTimestamps(undefined);
  };

  const handleOpenShowMore = () => {
    setShowMoreOpened(!showMoreOpened);
  };

  function copyText(text: string) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .catch((err) => console.error("Error copying:", err));
    }
  }

  function formatChatDate(date: Date) {
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";

    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
    });
  }
  const groups = useMemo(() => {
    const sortedMessages = [...messages].sort(
      (a, b) => a.createdAt - b.createdAt,
    );

    const result: {
      date: string;
      dateKey: string;
      messages: Message[];
    }[] = [];

    for (const message of sortedMessages) {
      const date = new Date(message.createdAt);

      const dateKey = [
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      ].join("-");

      const dateLabel = formatChatDate(date);
      const lastGroup = result[result.length - 1];

      if (!lastGroup || lastGroup.dateKey !== dateKey) {
        result.push({
          date: dateLabel,
          dateKey,
          messages: [message],
        });
      } else {
        lastGroup.messages.push(message);
      }
    }

    return result;
  }, [messages]);

  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      document.querySelectorAll<HTMLElement>(".sticky-badge").forEach((el) => {
        el.classList.remove(
          "-translate-y-12",
          "opacity-0",
          "pointer-events-none",
        );
        el.classList.add("translate-y-0", "opacity-100");
      });

      clearTimeout(scrollTimeout);

      scrollTimeout = setTimeout(() => {
        document
          .querySelectorAll<HTMLElement>(".sticky-badge")
          .forEach((el) => {
            const parentContainer =
              el.closest(".overflow-y-auto") || document.documentElement;
            const containerTop = parentContainer.getBoundingClientRect().top;
            const badgeTop = el.getBoundingClientRect().top;

            const isStuckAtTop = Math.abs(badgeTop - containerTop) <= 2;

            if (isStuckAtTop) {
              el.classList.remove("translate-y-0", "opacity-100");
              el.classList.add(
                "-translate-y-12",
                "opacity-0",
                "pointer-events-none",
              );
            }
          });
      }, 2000);
    };

    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      clearTimeout(scrollTimeout);
    };
  }, [groups]);

  const handleMessageDelete = (user: User, message: Message) => {
    if (!message) return;
    socket.emit("message-delete", user, message);
    setFocusedMessageId((current) => (current === message.id ? "" : current));
    handleMessages((prev) => prev.filter((msg) => msg !== message));
  };

  const container = groups.map((group) => (
    <div key={group.dateKey}>
      <div
        id={group.date}
        className="sticky-badge sticky top-0 z-20 text-center transform translate-y-0 transition-all duration-500 ease-in-out"
      >
        <Badge>{group.date}</Badge>
      </div>
      {group.messages.map((msg, index) => {
        const previous = group.messages[index - 1];
        const next = group.messages[index + 1];

        const sameAsPrevious = previous?.user?.id === msg?.user?.id;
        const sameAsNext = next?.user?.id === msg?.user?.id;
        const isNormalMessage = msg.type === "normal";

        const previousUserMessage = [...group.messages]
          .slice(0, index)
          .reverse()
          .find((message) => message.user);

        const nextUserMessage = group.messages
          .slice(index + 1)
          .find((message) => message.user);

        const MAX_GAP = 5 * 60 * 1000;

        const previousGrouped =
          !!msg.user &&
          !!previousUserMessage &&
          previousUserMessage.user!.id === msg.user.id &&
          new Date(msg.createdAt).getTime() -
            new Date(previousUserMessage.createdAt).getTime() <
            MAX_GAP;

        const nextGrouped =
          !!msg.user &&
          !!nextUserMessage &&
          nextUserMessage.user!.id === msg.user.id &&
          new Date(nextUserMessage.createdAt).getTime() -
            new Date(msg.createdAt).getTime() <
            MAX_GAP;

        const showAvatar = !nextGrouped;

        const showUsername = !previousGrouped;

        const isCurrentFocused = focusedMessageId === msg.id;
        const isAnyMessageFocused = focusedMessageId;

        const messageBody =
          isNormalMessage && msg ? (
            <MessageComponent
              className={cn(
                "transition-all",
                sameAsPrevious ? "mt-1" : "mt-6",
                isCurrentFocused && "z-20 scale-[1.02]",
                isAnyMessageFocused &&
                  !isCurrentFocused &&
                  "blur-xs opacity-40 select-none cursor-default",
              )}
              align={user?.id === msg.user?.id ? "end" : "start"}
            >
              {showAvatar ? (
                <MessageAvatar>
                  <Avatar>
                    {msg.user?.image && (
                      <AvatarImage src={msg.user.image} alt={msg.user.name} />
                    )}
                    <AvatarFallback>
                      {msg.user?.name?.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </MessageAvatar>
              ) : (
                <MessageAvatar />
              )}

              <MessageContent
                onMouseEnter={() => handleMouseEnterMessage(msg)}
                onMouseLeave={handleMouseLeaveMessage}
              >
                {showUsername ? (
                  <MessageHeader className="mt-2">
                    {msg.user?.name}
                  </MessageHeader>
                ) : (
                  <div className="w-10 shrink-0" />
                )}

                <div
                  className={cn(
                    "flex items-end gap-2",
                    user.id === msg.user.id ? "justify-end" : "justify-start",
                  )}
                >
                  {user.id === msg.user.id && (
                    <>
                      <span
                        className={cn(
                          "text-[10px] text-muted-foreground whitespace-nowrap duration-400 transition-opacity ease-out",
                          timestamps?.messageID === msg.id
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      >
                        {timestamps?.messageID === msg.id
                          ? timestamps?.time
                          : ""}
                      </span>
                      {/* {showMore?.messageID === msg.id && (
                        <button className="my-auto">
                          <MoreVertical className="scale-80" />
                        </button>
                      )} */}
                    </>
                  )}

                  <Bubble>
                    <ContextMenu
                      onOpenChange={(open) => {
                        if (open) setFocusedMessageId(msg.id);
                        else setFocusedMessageId("");
                      }}
                      // onOpenChangeComplete={() => handleContextMenu(msg.id)}
                    >
                      <BubbleContent render={<ContextMenuTrigger />}>
                        {msg.content}
                      </BubbleContent>
                      <ContextMenuContent>
                        <ContextMenuGroup>
                          <ContextMenuItem disabled>
                            <CalendarIcon />
                            {new Date(msg.createdAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </ContextMenuItem>
                        </ContextMenuGroup>
                        <ContextMenuSeparator />
                        <ContextMenuGroup>
                          {user.id === msg.user.id && (
                            <ContextMenuItem>
                              <EditIcon />
                              Edit
                            </ContextMenuItem>
                          )}
                          <ContextMenuItem
                            onClick={() => copyText(msg.content)}
                          >
                            <CopyIcon />
                            Copy
                          </ContextMenuItem>
                        </ContextMenuGroup>
                        {(user.id === msg.user.id ||
                          user.name?.includes("Shaeikh")) && (
                          <ContextMenuItem
                            variant="destructive"
                            onClick={() => handleMessageDelete(user, msg)}
                          >
                            <TrashIcon />
                            Delete
                          </ContextMenuItem>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  </Bubble>

                  {user.id !== msg.user.id && (
                    <span
                      className={cn(
                        "text-[10px] text-muted-foreground whitespace-nowrap duration-400 transition-opacity ease-out",
                        timestamps?.messageID === msg.id
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    >
                      {timestamps?.messageID === msg.id ? timestamps?.time : ""}
                    </span>
                  )}
                </div>
              </MessageContent>
            </MessageComponent>
          ) : (
            <div className="text-center">{msg.content}</div>
          );

        return (
          <div key={msg.id}>
            {/* {showDateSeparator && (
              <div className="text-center sticky top-0 z-50">
                <Badge>{formatChatDate(new Date(msg.createdAt))}</Badge>
              </div>
            )}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-50">
              <Badge>{formatChatDate(new Date(msg.createdAt))}</Badge>
            </div> */}
            {messageBody}
          </div>
        );
      })}
    </div>
  ));

  return (
    <>
      {container}
      {typingUsers.length > 0 && (
        <Marker role="status">
          <MarkerContent className="shimmer">
            <span className="font-medium">
              {typingUsers.length < 4
                ? typingUsers.map((u) => u.name).join(", ")
                : "Several people"}
            </span>{" "}
            {typingUsers.length === 1 ? "is" : "are"} typing...
          </MarkerContent>
        </Marker>
      )}
    </>
  );
}

function MessageSkeleton() {
  return (
    <div className="flex flex-col justify-between h-full w-full max-w-lg mx-auto py-2 overflow-hidden pointer-events-none select-none">
      {/* Date Header Skeleton */}
      <div className="flex justify-center my-2">
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      <div className="flex flex-col justify-end space-y-4 flex-1">
        <MessageComponent align="start">
          <MessageAvatar>
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          </MessageAvatar>
          <MessageContent>
            <MessageHeader className="mb-1">
              <Skeleton className="h-3 w-16" />
            </MessageHeader>
            <Bubble>
              <Skeleton className="h-10 w-44 rounded-3xl" />
            </Bubble>
          </MessageContent>
        </MessageComponent>

        <MessageComponent align="start" className="-mt-2">
          <MessageAvatar className="w-9">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          </MessageAvatar>
          <MessageContent>
            <Bubble>
              <Skeleton className="h-14 w-64 rounded-3xl" />
            </Bubble>
          </MessageContent>
        </MessageComponent>

        <MessageComponent align="end">
          <MessageAvatar className="w-9">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          </MessageAvatar>
          <MessageContent className="items-end">
            <MessageHeader className="mb-1">
              <Skeleton className="h-3 w-12" />
            </MessageHeader>
            <Bubble>
              <Skeleton className="h-16 w-72 rounded-3xl" />
            </Bubble>
          </MessageContent>
        </MessageComponent>

        <MessageComponent align="start">
          <MessageAvatar>
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          </MessageAvatar>
          <MessageContent>
            <MessageHeader className="mb-1">
              <Skeleton className="h-3 w-20" />
            </MessageHeader>
            <Bubble>
              <Skeleton className="h-10 w-32 rounded-3xl" />
            </Bubble>
          </MessageContent>
        </MessageComponent>

        <MessageComponent align="end">
          <MessageAvatar className="w-9" />
          <MessageContent className="items-end">
            <Bubble>
              <Skeleton className="h-10 w-48 rounded-3xl" />
            </Bubble>
          </MessageContent>
        </MessageComponent>
        <MessageComponent align="end">
          <MessageAvatar className="w-9" />
          <MessageContent className="items-end">
            <Bubble>
              <Skeleton className="h-10 w-48 rounded-3xl" />
            </Bubble>
          </MessageContent>
        </MessageComponent>
        <MessageComponent align="end">
          <MessageAvatar className="w-9">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          </MessageAvatar>
          <MessageContent className="items-end">
            <Bubble>
              <Skeleton className="h-20 w-48 rounded-3xl" />
            </Bubble>
          </MessageContent>
        </MessageComponent>
      </div>
    </div>
  );
}

export default function ChatUI({ serverSession }: ChatUIProps) {
  const [mobileRoomsOpen, setMobileRoomsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [messageContent, setMessageContent] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentRoom, setCurrentRoom] = useState<string>("");
  const [typingUsers, setTypingUsers] = useState<User[]>([]);
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatLoaded, setChatLoaded] = useState<boolean>(false);
  const [loadingPrevMessages, setLoadingPrevMessages] = useState(false);
  const [allChatMessagesLoaded, setAllChatMessagesLoaded] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  const isLoadingPreviousRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isLoadingPreviousRef.current) {
      return;
    }

    if (chatLoaded) {
      messagesEndRef.current?.scrollIntoView({
        behavior: "instant",
      });
    } else {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [chatLoaded, messages, typingUsers]);

  // useEffect(() => {
  //   const container = messagesContainerRef.current;

  //   if (container) {
  //     container.scrollTop = container.scrollHeight;
  //   }
  // }, [messages]);

  //   const sessionData = isPending ? serverSession : session;
  const sessionData = serverSession;

  const handleSendMessage = () => {
    if (!messageContent.trim()) return;
    const messageObj: Message = {
      user: sessionData?.user,
      room: currentRoom,
      type: "normal",
      id: uuidv7(),
      content: messageContent.trim(),
      createdAt: Date.now(),
    };
    socket.emit("send-message", messageObj);
    setMessageContent("");
  };

  const handleRoomJoin = (name: string) => {
    if (!name.trim() || currentRoom === name) return;

    const joinedRoomAlert = {
      user: "System",
      room: name,
      type: "system",
      id: uuidv7(),
      content: `${sessionData?.user.name} has Joined the room`,
      createdAt: Date.now(),
    };
    socket.emit("room-joined", name, sessionData.user);
    socket.emit("send-message", joinedRoomAlert);

    if (mobileRoomsOpen) {
      setMobileRoomsOpen(false);
    }

    // socket.on("user-online", (users) => {
    //   setOnlineUsers([users]);
    // });
  };

  useEffect(() => {
    const handleOnlineUsers = (
      onlineUsers: Array<{ id: string; name: string }>,
    ) => {
      setOnlineUsers(onlineUsers.map((u) => u.name));
    };

    socket.on("online-users-list", handleOnlineUsers);

    return () => {
      socket.off("online-users-list", handleOnlineUsers);
    };
  }, [currentRoom]);

  useEffect(() => {
    loadRoomData();
    setAllChatMessagesLoaded(false);
  }, [currentRoom]);

  const loadRoomData = async () => {
    if (!currentRoom) {
      setMessages([]);
      return;
    }
    try {
      setChatError(null);
      setChatLoading(true);
      const response = await fetch(`/api/chat/${currentRoom}`);
      if (!response.ok) {
        throw new Error("Failed to load messages");
      }
      const data = (await response.json()) as Message[];
      setMessages(data.filter((message: Message) => message.type !== "system"));
      setChatLoaded(true);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setChatLoading(false);
      setTimeout(() => {
        setChatLoaded(false);
      }, 500);
    }
  };

  const loadPreviousMessages = async () => {
    const container = messagesContainerRef.current;

    if (!container || !messages.length) {
      setLoadingPrevMessages(false);
      return;
    }

    isLoadingPreviousRef.current = true;

    const previousScrollHeight = container.scrollHeight;
    const previousScrollTop = container.scrollTop;

    try {
      const response = await fetch(
        `/api/chat/${currentRoom}?before=${messages[0].id}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load messages");
      }

      const data = (await response.json()) as Message[];

      if (data.length === 0) {
        setAllChatMessagesLoaded(true);
        return;
      }

      flushSync(() => {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((message) => message.id));

          const newMessages = data.filter(
            (message) => !existingIds.has(message.id),
          );

          return [...newMessages, ...prev];
        });
      });

      // Keep the user at the same message after prepending.
      const newScrollHeight = container.scrollHeight;

      container.scrollTop =
        previousScrollTop + (newScrollHeight - previousScrollHeight);
    } catch (e) {
      setChatError("Failed to load previous chats");
    } finally {
      setLoadingPrevMessages(false);
      isLoadingPreviousRef.current = false;
    }
  };

  useEffect(() => {
    const handleReceiveMessage = (message: Message) => {
      const room = message.room;
      setMessages((prev) => (room === currentRoom ? [...prev, message] : prev));
    };

    socket.on("receive-message", handleReceiveMessage);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
    };
  }, [currentRoom]);

  const isCurrentlyTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const typingData = {
      roomID: currentRoom,
      user: sessionData.user,
      isTyping: true,
    };

    if (messageContent.trim()) {
      if (!isCurrentlyTypingRef.current) {
        isCurrentlyTypingRef.current = true;
        socket.emit("typing", typingData);
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        isCurrentlyTypingRef.current = false;
        socket.emit("typing", { ...typingData, isTyping: false });
      }, 3000);
    } else {
      // If the user completely deletes their input text, stop typing immediately
      if (isCurrentlyTypingRef.current) {
        isCurrentlyTypingRef.current = false;
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        socket.emit("typing", { ...typingData, isTyping: false });
      }
    }
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [messageContent, currentRoom, sessionData.user]);

  useEffect(() => {
    const handleUserTyping = (typingData: any) => {
      if (typingData.user.id === sessionData.user.id) return;

      if (typingData.isTyping) {
        setTypingUsers((prev) => {
          if (prev.some((u) => u.id === typingData.user.id)) {
            return prev;
          }

          return [...prev, typingData.user];
        });
      } else {
        setTypingUsers((prev) =>
          prev.filter((user) => user.id !== typingData.user.id),
        );
      }
    };

    socket.on("user-typing", handleUserTyping);

    return () => {
      socket.off("user-typing", handleUserTyping);
    };
  }, [sessionData.user.id]);
  return (
    sessionData && (
      <div className="h-screen flex min-h-0 overflow-hidden">
        {sessionData.user && (
          <div
            className={cn(
              "hidden shrink-0 border-r bg-muted/30 transition-[width] duration-200 md:flex md:flex-col",
              sidebarCollapsed ? "w-16" : "w-60",
            )}
          >
            {/* Header */}
            <div
              className={cn(
                "flex h-16 items-center border-b",
                sidebarCollapsed
                  ? "justify-center px-2"
                  : "justify-between px-4",
              )}
            >
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Chat
                  </p>
                  <h1 className="text-lg font-semibold">Rooms</h1>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={
                  sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                }
              >
                {sidebarCollapsed ? (
                  <ChevronRightIcon className="h-4 w-4" />
                ) : (
                  <ChevronLeftIcon className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Rooms */}
            <div className="flex-1 overflow-y-auto p-3">
              {!sidebarCollapsed && (
                <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Available rooms
                </p>
              )}

              <div className="space-y-1">
                <Room
                  name="General"
                  onRoomChange={setCurrentRoom}
                  onRoomJoin={handleRoomJoin}
                  collapsed={sidebarCollapsed}
                  active={currentRoom === "General"}
                />

                <Room
                  name="Lobby"
                  onRoomChange={setCurrentRoom}
                  onRoomJoin={handleRoomJoin}
                  collapsed={sidebarCollapsed}
                  active={currentRoom === "Lobby"}
                />
              </div>
            </div>

            <div className="shrink-0 overflow-hidden border-t p-3">
              <div
                className={cn(
                  "bg-input/50 flex min-w-0 items-center rounded-lg",
                  sidebarCollapsed
                    ? "justify-center p-0"
                    : "justify-between px-3 py-2",
                )}
              >
                {!sidebarCollapsed && (
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="text-[11px] text-muted-foreground">
                      Current room
                    </p>

                    <p className="truncate text-sm font-medium">
                      {currentRoom || "No room selected"}
                    </p>
                  </div>
                )}

                <div className="shrink-0">
                  <ModeToggle />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="relative flex-1 min-w-0 min-h-0 flex flex-col">
          {/* Mobile header */}
          <div className="md:hidden shrink-0">
            <div className="flex items-center justify-between px-4 mt-2">
              <button
                onClick={() => setMobileRoomsOpen((prev) => !prev)}
                className="px-2 py-1 rounded-md text-sm border"
              >
                Rooms
              </button>

              <div className="font-bold text-lg truncate">
                {currentRoom || "Select a room"}
              </div>

              <ModeToggle />
            </div>

            {mobileRoomsOpen && (
              <div className="px-4 pb-2 space-y-2">
                <Room
                  name="General"
                  onRoomChange={setCurrentRoom}
                  onRoomJoin={handleRoomJoin}
                />
                <Room
                  name="Lobby"
                  onRoomChange={setCurrentRoom}
                  onRoomJoin={handleRoomJoin}
                />
              </div>
            )}
          </div>
          {currentRoom && sessionData.user && (
            <div className="relative flex-1 min-w-0 min-h-0 flex flex-col">
              {/* <Image
              src="/chat-bg.jpg"
              alt="Background graphic"
              fill
              priority
              className="max-w-136 opacity-60 not-dark:opacity-90 flex flex-col w-full mx-auto -z-10"
            /> */}
              <div className="mx-4">
                <div className="mx-auto mt-2 w-full max-w-lg rounded-2xl border bg-input/50 p-3 shadow-sm md:max-w-3xl md:p-4">
                  <div className="mb-3 hidden items-center md:flex">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Room
                      </p>
                      <h2 className="truncate text-xl font-bold">
                        {currentRoom}
                      </h2>
                    </div>
                  </div>

                  <div className="flex min-h-8 items-center gap-2">
                    {onlineUsers.length > 0 ? (
                      <>
                        <div className="flex shrink-0 items-center gap-1.5 text-sm font-medium">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          <span className="md:hidden">Online</span>
                          <span className="hidden md:inline">Online users</span>
                        </div>
                        <div className="flex min-w-0 flex-wrap gap-1.5">
                          {onlineUsers.map((u) => (
                            <Badge
                              key={u}
                              variant="secondary"
                              className="rounded-full px-2.5 py-1 text-xs font-medium"
                            >
                              @{u}
                            </Badge>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1.5 text-sm font-medium">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="md:hidden">Offline</span>
                        <span className="hidden md:inline">
                          No users online
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div
                ref={messagesContainerRef}
                className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-8 scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-transparent mt-3"
                onScroll={(e) => {
                  if (
                    e.currentTarget.scrollTop <= 100 &&
                    !loadingPrevMessages &&
                    !allChatMessagesLoaded
                  ) {
                    setLoadingPrevMessages(true);
                    loadPreviousMessages();
                  }
                }}
              >
                <div className="w-full max-w-lg md:max-w-3xl mx-auto min-h-full flex flex-col justify-end">
                  {loadingPrevMessages && (
                    <div className="mt-3 mb-5 mx-auto">
                      <TripleDotSpinner />
                    </div>
                  )}

                  {chatLoading ? (
                    <MessageSkeleton />
                  ) : chatError ? (
                    <div className="mx-auto max-w-md w-full">
                      <div className="p-2 px-6 bg-red-500 rounded-xl flex justify-between items-center">
                        <span className="text-left text-white">
                          {chatError}
                        </span>

                        <button onClick={loadRoomData}>
                          <div className="flex hover:text-white text-white/80 cursor-pointer items-center gap-2 text-sm transition-colors duration-200">
                            <MarkerContent>Try Again</MarkerContent>
                            <MarkerIcon>
                              <RotateCcwIcon />
                            </MarkerIcon>
                          </div>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <MessageContainer
                      typingUsers={typingUsers}
                      messages={messages}
                      handleMessages={setMessages}
                      user={sessionData.user}
                    />
                  )}

                  <div ref={messagesEndRef} />

                  <div className="shrink-0 sticky bottom-0 z-21 border-none p-3 w-full max-w-lg md:max-w-3xl mx-auto">
                    <MessageInput
                      message={messageContent}
                      onMessageChange={setMessageContent}
                      onMessageSend={handleSendMessage}
                      disabled={Boolean(chatLoading || chatError)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  );
}
