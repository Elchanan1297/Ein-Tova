export type StartStatus = 'OK' | 'AlreadyStarted' | 'Closed' | 'NoQuestions';

export interface StartResult {
  status: StartStatus;
  total?: number;
}

export interface QuestionHead {
  status: 'InProgress';
  position: number;
  total: number;
  score: number;
  limitSec: number;
  secondsLeft: number;
  questionId: number;
  body: string;
  imageUrl: string | null;
}

export type NextHead =
  | QuestionHead
  | { status: 'NoAttempt' }
  | { status: 'Finished' | 'Closed'; score: number; total: number };

export interface AnswerOption {
  optionId: number;
  body: string;
}

export interface NextResult {
  head: NextHead;
  options: AnswerOption[];
}

export type AnswerResult =
  | {
      status: 'OK';
      isCorrect: boolean;
      timedOut: boolean;
      correctOptionId: number;
      fact: string | null;
      score: number;
      total: number;
      isFinished: boolean;
    }
  | { status: 'NoActiveAttempt' | 'NoActiveQuestion' | 'BadOption' | 'TooEarly' };
