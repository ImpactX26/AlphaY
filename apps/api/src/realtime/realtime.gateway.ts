import { Logger } from '@nestjs/common';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { ServerMessage } from '@educaro/shared';
import { verifyToken } from '../auth/jwt';

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly log = new Logger('Realtime');
  @WebSocketServer() server: Server;

  handleConnection(client: Socket) {
    const token = (client.handshake.auth?.token as string) || '';
    const user = verifyToken(token);
    if (!user) {
      client.disconnect(true);
      return;
    }
    if (user.role === 'staff') client.join('staff');
    if (user.applicantId) client.join(`applicant:${user.applicantId}`);
    client.on('watch', (applicantId: string) => {
      if (user.role === 'staff') client.join(`applicant:${applicantId}`);
    });
  }

  toApplicant(applicantId: string, msg: ServerMessage) {
    this.server?.to(`applicant:${applicantId}`).emit('msg', msg);
  }

  toStaff(msg: ServerMessage) {
    this.server?.to('staff').emit('msg', msg);
  }

  toBoth(applicantId: string, msg: ServerMessage) {
    this.server?.to(`applicant:${applicantId}`).to('staff').emit('msg', msg);
  }
}
