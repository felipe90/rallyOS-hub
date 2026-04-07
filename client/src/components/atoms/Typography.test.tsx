import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Headline, Title, Body, Label, Caption, Typography } from '../atoms/Typography'
import React from 'react'

describe('Typography', () => {
  describe('Headline', () => {
    it('renders h1 with Space Grotesk font', () => {
      render(<Headline>Test Title</Headline>)
      const el = screen.getByRole('heading', { level: 1 })
      expect(el).toBeInTheDocument()
      expect(el).toHaveTextContent('Test Title')
      expect(el).toHaveClass('font-heading')
    })
  })

  describe('Title', () => {
    it('renders h2 with Space Grotesk font', () => {
      render(<Title>Subtitle</Title>)
      const el = screen.getByRole('heading', { level: 2 })
      expect(el).toBeInTheDocument()
      expect(el).toHaveTextContent('Subtitle')
      expect(el).toHaveClass('font-heading')
    })
  })

  describe('Body', () => {
    it('renders p with Manrope font', () => {
      render(<Body>Some text</Body>)
      const el = screen.getByText('Some text')
      expect(el).toBeInTheDocument()
      expect(el).toHaveClass('font-body')
    })
  })

  describe('Label', () => {
    it('renders uppercase span', () => {
      render(<Label>UPPERCASE LABEL</Label>)
      const el = screen.getByText('UPPERCASE LABEL')
      expect(el).toBeInTheDocument()
    })
  })

  describe('Caption', () => {
    it('renders small text', () => {
      render(<Caption>note text</Caption>)
      const el = screen.getByText('note text')
      expect(el).toBeInTheDocument()
    })
  })
})