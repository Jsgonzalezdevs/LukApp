import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider, useLanguage } from './LanguageContext';

const Consumer = () => {
  const { language, t, toggleLanguage } = useLanguage();
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="role">{t.hero.role}</span>
      <button onClick={toggleLanguage}>toggle</button>
    </div>
  );
};

describe('LanguageContext', () => {
  it('defaults to Spanish', () => {
    render(
      <LanguageProvider>
        <Consumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('language')).toHaveTextContent('es');
  });

  it('switches translations when toggled', () => {
    render(
      <LanguageProvider>
        <Consumer />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByText('toggle'));

    expect(screen.getByTestId('language')).toHaveTextContent('en');
    expect(screen.getByTestId('role')).toHaveTextContent('Software Developer');
  });
});
