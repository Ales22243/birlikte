import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Note } from './db'

export const useNotes = (): Note[] | undefined => useLiveQuery(() => db.notes.orderBy('date').toArray(), [])

export type NoteInput = Pick<Note, 'title' | 'text' | 'date' | 'time'>

export const addNote = (n: NoteInput) => db.notes.add({ ...n, createdAt: Date.now() } as Note)
export const updateNote = (id: number, n: NoteInput) => db.notes.update(id, n)
export const deleteNote = (id: number) => db.notes.delete(id)
