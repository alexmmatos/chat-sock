import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  let service: PresenceService;

  beforeEach(() => {
    service = new PresenceService();
  });

  it('fica online na primeira conexão', () => {
    const justOnline = service.registerConnection('user-1', 'socket-1');

    expect(justOnline).toBe(true);
    expect(service.isOnline('user-1')).toBe(true);
    expect(service.getSocketIds('user-1')).toEqual(['socket-1']);
  });

  it('permanece online com múltiplas conexões e não reemite "ficou online"', () => {
    service.registerConnection('user-1', 'socket-1');
    const justOnlineAgain = service.registerConnection('user-1', 'socket-2');

    expect(justOnlineAgain).toBe(false);
    expect(service.getSocketIds('user-1').sort()).toEqual([
      'socket-1',
      'socket-2',
    ]);
  });

  it('permanece online se ainda houver outra conexão ativa ao desconectar uma', () => {
    service.registerConnection('user-1', 'socket-1');
    service.registerConnection('user-1', 'socket-2');

    const result = service.removeConnection('socket-1');

    expect(result).toEqual({ userId: 'user-1', wentOffline: false });
    expect(service.isOnline('user-1')).toBe(true);
  });

  it('fica offline na última desconexão', () => {
    service.registerConnection('user-1', 'socket-1');

    const result = service.removeConnection('socket-1');

    expect(result).toEqual({ userId: 'user-1', wentOffline: true });
    expect(service.isOnline('user-1')).toBe(false);
    expect(service.getSocketIds('user-1')).toEqual([]);
  });

  it('removeConnection retorna null para socket desconhecido', () => {
    expect(service.removeConnection('unknown')).toBeNull();
  });

  it('usuário nunca conectado está offline', () => {
    expect(service.isOnline('ghost')).toBe(false);
  });

  it('notifica apenas quem chamou watch para aquele userId', () => {
    service.watch('watcher-socket', 'user-1');

    expect(service.getWatcherSocketIds('user-1')).toEqual(['watcher-socket']);
    expect(service.getWatcherSocketIds('user-2')).toEqual([]);
  });

  it('remove o watcher de todas as entradas quando ele desconecta', () => {
    service.registerConnection('watcher-user', 'watcher-socket');
    service.watch('watcher-socket', 'user-1');

    service.removeConnection('watcher-socket');

    expect(service.getWatcherSocketIds('user-1')).toEqual([]);
  });
});
