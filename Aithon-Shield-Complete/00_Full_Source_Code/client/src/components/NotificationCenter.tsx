import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  scanId: string | null;
  scanType: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationCenter() {
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000,
  });

  // Calculate unread count from actual displayed notifications
  // This ensures the badge count matches what users can see and interact with
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to mark as read');
      return res.json();
    },
    onMutate: async (notificationId: string) => {
      // Cancel outgoing queries to avoid race conditions
      await queryClient.cancelQueries({ queryKey: ['/api/notifications'] });
      
      const previousNotifications = queryClient.getQueryData<Notification[]>(['/api/notifications']);
      
      // Check if notification is already read to prevent duplicate updates
      const targetNotification = previousNotifications?.find(n => n.id === notificationId);
      const isAlreadyRead = targetNotification?.read === true;
      
      if (!isAlreadyRead && previousNotifications) {
        // Mark notification as read in cache - count will update automatically
        queryClient.setQueryData<Notification[]>(
          ['/api/notifications'],
          previousNotifications.map(n => 
            n.id === notificationId ? { ...n, read: true } : n
          )
        );
      }
      
      // Return context for rollback on error
      return { previousNotifications, isAlreadyRead };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
    onError: (error, notificationId, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(
          ['/api/notifications'],
          context.previousNotifications
        );
      }
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to mark all as read');
      return res.json();
    },
    onMutate: async () => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['/api/notifications'] });
      
      const previousNotifications = queryClient.getQueryData<Notification[]>(['/api/notifications']);
      
      // Mark all notifications as read in cache - count will update automatically
      if (previousNotifications) {
        queryClient.setQueryData<Notification[]>(
          ['/api/notifications'],
          previousNotifications.map(n => ({ ...n, read: true }))
        );
      }
      
      return { previousNotifications };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(
          ['/api/notifications'],
          context.previousNotifications
        );
      }
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    // Only mark as read if currently unread - avoids redundant API traffic
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }

    // Navigate to relevant scan page if applicable
    if (notification.scanId && notification.scanType) {
      let path = '';
      switch (notification.scanType) {
        case 'mvp':
          path = `/mvp-code-scan?selected=${notification.scanId}`;
          break;
        case 'mobile':
          path = `/mobile-app-scan?selected=${notification.scanId}`;
          break;
        case 'web':
          path = `/web-app-scan?selected=${notification.scanId}`;
          break;
        case 'ci-cd':
          path = `/pipeline-scan?selected=${notification.scanId}`;
          break;
        case 'container':
          path = `/container-scan?selected=${notification.scanId}`;
          break;
        case 'network':
          path = `/network-scan?selected=${notification.scanId}`;
          break;
        case 'linter':
          path = `/code-linter-scan?selected=${notification.scanId}`;
          break;
      }
      if (path) {
        setLocation(path);
        setIsOpen(false);
      }
    }
  };

  // Show all notifications (backend already limits to 50), no frontend slicing
  // This ensures unread count matches what's visible
  const displayedNotifications = notifications;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notification-center"
          data-has-unread={unreadCount > 0 ? "true" : "false"}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
              data-testid="badge-unread-count"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-2">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              data-testid="button-mark-all-read"
            >
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          <div className="flex flex-col">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              displayedNotifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex flex-col items-start gap-1 px-4 py-3 cursor-pointer"
                  onClick={() => handleNotificationClick(notification)}
                  data-testid={`notification-item-${notification.id}`}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className={`font-medium text-sm ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {notification.title}
                    </span>
                    {!notification.read && (
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </span>
                </DropdownMenuItem>
              ))
            )}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
