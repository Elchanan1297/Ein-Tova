export interface Greeting {
  greetingId: number;
  senderName: string;
  relation: string | null;
  kind: 'text' | 'image' | 'video';
  body: string | null;
  mediaUrl: string | null;
}
