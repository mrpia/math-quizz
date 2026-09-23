import { describe, expect, test, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { ExerciseListScreen } from '../screens/ExerciseListScreen';
import { DEFAULT_SETTINGS } from '../domain/session';
import { renderWithLanguage } from './renderWithLanguage';

const listSettings = {
  ...DEFAULT_SETTINGS,
  selectedTables: [7],
  mode: 'mul' as const,
  questionCount: 11,
};

const renderScreen = (onCancel = () => {}) =>
  renderWithLanguage(
    <ExerciseListScreen profileId="default" settings={listSettings} onCancel={onCancel} />,
  );

describe('ExerciseListScreen', () => {
  test('renders one hidden row per question', () => {
    renderScreen();
    expect(
      screen.getAllByRole('button', { name: 'montrer la réponse' }),
    ).toHaveLength(11);
    // answers hidden: the product 56 (7×8) is not shown yet
    expect(screen.queryByText('56')).not.toBeInTheDocument();
  });

  test('the global button reveals every answer then hides them again', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /^montrer les réponses$/i }));
    expect(screen.getByText('56')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'cacher la réponse' }),
    ).toHaveLength(11);

    fireEvent.click(screen.getByRole('button', { name: /^cacher les réponses$/i }));
    expect(screen.queryByText('56')).not.toBeInTheDocument();
  });

  test('tapping one row reveals only that answer', () => {
    renderScreen();
    const rows = screen.getAllByRole('button', { name: 'montrer la réponse' });
    fireEvent.click(rows[0]);
    expect(
      screen.getAllByRole('button', { name: 'cacher la réponse' }),
    ).toHaveLength(1);
  });

  test('"Nouvelle liste" re-renders rows and resets reveal state', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /^montrer les réponses$/i }));
    fireEvent.click(screen.getByRole('button', { name: /nouvelle liste/i }));
    expect(
      screen.getAllByRole('button', { name: 'montrer la réponse' }),
    ).toHaveLength(11);
  });

  test('the back button calls onCancel', () => {
    const onCancel = vi.fn();
    renderScreen(onCancel);
    fireEvent.click(screen.getByRole('button', { name: /retour à l'accueil/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
