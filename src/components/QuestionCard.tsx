import type { Question } from '../domain/question';
import { formatOperation } from '../domain/question';
import './QuestionCard.css';

type Props = {
  question: Question;
  given: string;
  /** 'correct' tints the answer green — used to reinforce the right answer. */
  answerTone?: 'neutral' | 'correct';
};

export const QuestionCard = ({ question, given, answerTone = 'neutral' }: Props) => (
  <div className="question-card">
    <div className="question-card__operation" data-testid="question-operation">
      {formatOperation(question)} <span className="question-card__equals">=</span>
    </div>
    <div
      data-testid="answer-value"
      className={`question-card__answer${given === '' ? ' question-card__answer--empty' : ''}${
        answerTone === 'correct' ? ' question-card__answer--correct' : ''
      }`}
    >
      {given === '' ? '?' : given}
    </div>
  </div>
);
