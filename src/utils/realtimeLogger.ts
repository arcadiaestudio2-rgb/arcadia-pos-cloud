
export type RealtimeLogEvent = 
  | 'REALTIME_INIT'
  | 'REALTIME_CREATE'
  | 'REALTIME_REUSE'
  | 'REALTIME_SUBSCRIBE'
  | 'REALTIME_REMOVE'
  | 'REALTIME_ERROR'
  | 'REALTIME_CLOSED'
  | 'REALTIME_RECONNECT'
  | 'REALTIME_READY';

export const logRealtime = (event: RealtimeLogEvent, channelName?: string, payload?: any) => {
  const timestamp = new Date().toISOString();
  const logPrefix = `[${event}]`;
  const channelInfo = channelName ? ` [Channel: ${channelName}]` : '';
  
  const logMessage = `${timestamp} ${logPrefix}${channelInfo}`;
  
  if (payload) {
    console.log(logMessage, payload);
  } else {
    console.log(logMessage);
  }
};
