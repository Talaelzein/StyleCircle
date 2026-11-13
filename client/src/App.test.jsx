import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App.jsx';

describe('StyleCircle starter', () => {
  it('shows the project name and milestone scaffold', () => {
    render(<App />);
    expect(screen.getByText('Milestone 1 scaffold ready')).toBeInTheDocument();
    expect(screen.getByText('Your social fashion closet.')).toBeInTheDocument();
  });
});
