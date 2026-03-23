import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Bot, Send, Loader2, Sparkles, X, Minimize2, Maximize2, HelpCircle } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Finding } from "@shared/schema";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface SecurityChatbotProps {
  findingId?: string;
  embedded?: boolean;
  onClose?: () => void;
}

export function SecurityChatbot({ findingId, embedded = false, onClose }: SecurityChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: embedded 
        ? "Hi! I'm your security assistant. Ask me anything about vulnerabilities, security best practices, or your findings."
        : "Hi! I'm your security assistant. I can help you understand vulnerabilities, explain security concepts, and provide remediation guidance. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch all findings for context
  const { data: findings = [] } = useQuery<Finding[]>({
    queryKey: ["/api/findings"],
    enabled: !findingId,
  });

  // Fetch specific finding if provided
  const { data: specificFinding } = useQuery<Finding>({
    queryKey: ["/api/findings", findingId],
    enabled: !!findingId,
  });

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      // Build context from findings
      let context = "";
      if (specificFinding) {
        context = `Current finding: ${specificFinding.title} (${specificFinding.severity}, CWE-${specificFinding.cwe})`;
      } else if (findings.length > 0) {
        const criticalCount = findings.filter(f => f.severity === "CRITICAL").length;
        const highCount = findings.filter(f => f.severity === "HIGH").length;
        context = `User has ${findings.length} total findings: ${criticalCount} critical, ${highCount} high`;
      }

      return apiRequest("POST", "/api/chat", {
        message: userMessage,
        context,
        findingId,
      });
    },
    onSuccess: (response: any) => {
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: response.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: () => {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    chatMutation.mutate(input);
    setInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const suggestedQuestions = [
    "What are the most common security vulnerabilities?",
    "How do I fix an SQL injection?",
    "Explain Cross-Site Scripting (XSS)",
    "What is OWASP Top 10?",
  ];

  if (!embedded && isMinimized) {
    return (
      <Card className="fixed bottom-6 right-6 p-3 shadow-lg z-50 cursor-pointer hover-elevate" onClick={() => setIsMinimized(false)}>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-medium text-sm">Security Assistant</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={embedded ? "h-full flex flex-col" : "fixed bottom-6 right-6 w-96 h-[600px] shadow-lg z-50 flex flex-col"}>
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Security Assistant</h3>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!embedded && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsMinimized(true)}
                data-testid="button-minimize-chat"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
                data-testid="button-close-chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
                data-testid={`message-${message.role}`}
              >
                {message.role === "assistant" && (
                  <div className="flex items-center gap-1 mb-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium">AI Assistant</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <span className="text-xs opacity-70 mt-1 block">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {messages.length === 1 && (
          <div className="mt-6 space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Suggested questions:</p>
            <div className="space-y-2">
              {suggestedQuestions.map((question) => (
                <Button
                  key={question}
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-2 px-3"
                  onClick={() => {
                    setInput(question);
                    setTimeout(() => handleSend(), 100);
                  }}
                  data-testid={`button-suggested-${question.substring(0, 20)}`}
                >
                  <HelpCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="text-xs">{question}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>

      <Separator />

      <div className="p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask me anything about security..."
            disabled={chatMutation.isPending}
            data-testid="input-chat-message"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            size="icon"
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {specificFinding && (
          <Badge variant="secondary" className="mt-2 text-xs">
            Context: {specificFinding.title}
          </Badge>
        )}
      </div>
    </Card>
  );
}

export function FloatingChatButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="icon"
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
      onClick={onClick}
      data-testid="button-open-chat"
    >
      <Bot className="h-6 w-6" />
    </Button>
  );
}
