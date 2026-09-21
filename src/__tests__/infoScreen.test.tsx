import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AUTHOR_LABEL, AUTHOR_URL, SUPPORT_URL } from '../config/site';
import { InfoScreen } from '../screens/InfoScreen';
import { releaseNotes } from '../domain/releaseNotes';
import { renderWithLanguage } from './renderWithLanguage';

describe('InfoScreen', () => {
  test('shows the app version it is given', () => {
    render(<InfoScreen version="9.9.9" onBack={() => {}} />);
    expect(screen.getByText(/9\.9\.9/)).toBeInTheDocument();
  });

  test('lists the latest release note (version + change text)', () => {
    render(<InfoScreen version="9.9.9" onBack={() => {}} />);
    const latest = releaseNotes[0];
    expect(screen.getByText(latest.changes.fr[0])).toBeInTheDocument();
    expect(
      screen.getAllByText(new RegExp(latest.version.replace(/\./g, '\\.'))).length,
    ).toBeGreaterThan(0);
  });

  test('explains where the user data is stored', () => {
    render(<InfoScreen version="9.9.9" onBack={() => {}} />);
    expect(
      screen.getByText(/cet appareil|ce navigateur|rien n'est envoyé/i),
    ).toBeInTheDocument();
  });

  test('shows the Zürich credit line with the website as an inline link', () => {
    render(<InfoScreen version="9.9.9" onBack={() => {}} />);
    expect(screen.getByText(/Conçu avec.*à Zürich, Suisse/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: AUTHOR_LABEL });
    expect(link).toHaveAttribute('href', AUTHOR_URL);
    // The {link} placeholder must be rendered as the link, never shown literally.
    expect(screen.queryByText(/\{link\}/)).toBeNull();
  });

  test('shows a Buy Me a Coffee link (coffee emoji, opens in a new tab)', () => {
    render(<InfoScreen version="9.9.9" onBack={() => {}} />);
    const coffee = screen.getByRole('link', { name: /☕/ });
    expect(coffee).toHaveAttribute('href', SUPPORT_URL);
    expect(coffee).toHaveAttribute('target', '_blank');
  });

  test('routes the coffee support through the parents (child is the messenger)', () => {
    render(<InfoScreen version="9.9.9" onBack={() => {}} />);
    // Scope to the support panel — the same parent-routed wording also appears
    // in the 0.7.1 release note further down the page.
    const panel = screen.getByRole('heading', { name: /Soutenir l'appli/i }).closest('section');
    expect(panel).not.toBeNull();
    const support = within(panel as HTMLElement);
    // The child is told to talk to their parents, who then decide.
    expect(support.getByText(/dis-le à tes parents/i)).toBeInTheDocument();
    // The clickable phrase is the support action itself, inline in the sentence.
    const coffee = support.getByRole('link', { name: /m'offrir un café/i });
    expect(coffee).toHaveAttribute('href', SUPPORT_URL);
  });

  test('surfaces support in a dedicated section', () => {
    render(<InfoScreen version="9.9.9" onBack={() => {}} />);
    expect(
      screen.getByRole('heading', { name: /Soutenir l'appli/i }),
    ).toBeInTheDocument();
  });

  test('back button calls onBack', () => {
    const onBack = vi.fn();
    render(<InfoScreen version="9.9.9" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /retour/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  test('shows notes in the selected language and drops the French disclaimer', () => {
    renderWithLanguage(<InfoScreen version="9.9.9" onBack={() => {}} />, 'de');
    const latest = releaseNotes[0];
    expect(screen.getByText(latest.changes.de[0])).toBeInTheDocument();
    expect(
      screen.queryByText('Diese Hinweise sind auf Französisch.'),
    ).not.toBeInTheDocument();
  });
});
