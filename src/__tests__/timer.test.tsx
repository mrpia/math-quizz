import { describe, expect, test } from 'vitest';
import { screen } from '@testing-library/react';
import { Timer } from '../components/Timer';
import { renderWithLanguage } from './renderWithLanguage';

describe('Timer', () => {
  test('shows a half-second target as is, not rounded up (#38)', () => {
    renderWithLanguage(<Timer targetMs={2500} resetKey={0} />);
    expect(screen.getByText(/cible 2\.5s/)).toBeInTheDocument();
  });

  test('shows a whole-second target without a decimal', () => {
    renderWithLanguage(<Timer targetMs={4000} resetKey={0} />);
    expect(screen.getByText(/cible 4s/)).toBeInTheDocument();
  });
});
