import { Injectable } from '@nestjs/common';

@Injectable()
export class PresenceService {
  private readonly userSockets = new Map<string, Set<string>>();
  private readonly socketUsers = new Map<string, string>();
  private readonly watchers = new Map<string, Set<string>>();

  /** Registra um socket autenticado. Retorna true se o usuário acabou de ficar online. */
  registerConnection(userId: string, socketId: string): boolean {
    this.socketUsers.set(socketId, userId);

    const sockets = this.userSockets.get(userId);
    if (sockets) {
      const wasOnline = sockets.size > 0;
      sockets.add(socketId);
      return !wasOnline;
    }

    this.userSockets.set(userId, new Set([socketId]));
    return true;
  }

  /** Remove um socket. Retorna o userId e se ele acabou de ficar offline. */
  removeConnection(
    socketId: string,
  ): { userId: string; wentOffline: boolean } | null {
    const userId = this.socketUsers.get(socketId);
    if (!userId) {
      return null;
    }

    this.socketUsers.delete(socketId);
    this.unwatchAll(socketId);

    const sockets = this.userSockets.get(userId);
    if (!sockets) {
      return { userId, wentOffline: false };
    }

    sockets.delete(socketId);
    const wentOffline = sockets.size === 0;
    if (wentOffline) {
      this.userSockets.delete(userId);
    }

    return { userId, wentOffline };
  }

  isOnline(userId: string): boolean {
    return (this.userSockets.get(userId)?.size ?? 0) > 0;
  }

  getSocketIds(userId: string): string[] {
    return Array.from(this.userSockets.get(userId) ?? []);
  }

  /** Registra que `watcherSocketId` quer ser avisado de mudanças de presença de `watchedUserId`. */
  watch(watcherSocketId: string, watchedUserId: string): void {
    const set = this.watchers.get(watchedUserId) ?? new Set<string>();
    set.add(watcherSocketId);
    this.watchers.set(watchedUserId, set);
  }

  getWatcherSocketIds(watchedUserId: string): string[] {
    return Array.from(this.watchers.get(watchedUserId) ?? []);
  }

  private unwatchAll(watcherSocketId: string): void {
    for (const [watchedUserId, set] of this.watchers) {
      set.delete(watcherSocketId);
      if (set.size === 0) {
        this.watchers.delete(watchedUserId);
      }
    }
  }
}
