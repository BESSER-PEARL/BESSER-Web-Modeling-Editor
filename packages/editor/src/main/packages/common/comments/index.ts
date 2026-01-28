import { Comments } from './comments';

export const CommentsElementType = {
  Comments: 'Comments',
} as const;

export type CommentsElement = Comments;
