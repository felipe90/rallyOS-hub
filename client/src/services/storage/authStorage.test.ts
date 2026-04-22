import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authStorage } from './authStorage'

describe('authStorage', () => {
  beforeEach(() => {
    // Clear storage before each test
    localStorage.clear()
    sessionStorage.clear()
  })

  it('stores and retrieves role', () => {
    authStorage.setRole('owner')
    expect(authStorage.getRole()).toBe('owner')
  })

  it('removes role when set to null', () => {
    authStorage.setRole('owner')
    authStorage.setRole(null)
    expect(authStorage.getRole()).toBeNull()
  })

  it('stores and retrieves tableId', () => {
    authStorage.setTableId('table-1')
    expect(authStorage.getTableId()).toBe('table-1')
  })

  it('stores ownerPin in sessionStorage', () => {
    authStorage.setOwnerPin('12345678')
    expect(sessionStorage.getItem('ownerPin')).toBe('12345678')
    expect(authStorage.getOwnerPin()).toBe('12345678')
  })

  it('clears all auth data', () => {
    authStorage.setRole('owner')
    authStorage.setTableId('table-1')
    authStorage.setOwnerPin('12345678')
    authStorage.setTablePin('1234')

    authStorage.clear()

    expect(authStorage.getRole()).toBeNull()
    expect(authStorage.getTableId()).toBeNull()
    expect(authStorage.getOwnerPin()).toBeNull()
    expect(authStorage.getTablePin()).toBeNull()
  })
})
