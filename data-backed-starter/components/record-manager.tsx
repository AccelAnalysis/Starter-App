"use client";

import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
  updateDoc,
} from "firebase/firestore";
import { FormEvent, useEffect, useState } from "react";
import { db } from "@/lib/firebase";

type RecordItem = {
  id: string;
  title: string;
  content: string;
  createdAt?: Timestamp;
};

type Props = { user: User };

export function RecordManager({ user }: Props) {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!db) return;

    const recordsQuery = query(
      collection(db, "users", user.uid, "records"),
      orderBy("createdAt", "desc"),
    );

    return onSnapshot(
      recordsQuery,
      (snapshot) => {
        setRecords(snapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() } as RecordItem)));
        setError("");
      },
      (snapshotError) => setError(snapshotError.message),
    );
  }, [user.uid]);

  function resetForm() {
    setTitle("");
    setContent("");
    setEditingId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !title.trim()) return;

    setSaving(true);
    setError("");

    try {
      if (editingId) {
        await updateDoc(doc(db, "users", user.uid, "records", editingId), {
          title: title.trim(),
          content: content.trim(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "users", user.uid, "records"), {
          title: title.trim(),
          content: content.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      resetForm();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save the record.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(record: RecordItem) {
    setEditingId(record.id);
    setTitle(record.title);
    setContent(record.content);
  }

  async function removeRecord(recordId: string) {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "records", recordId));
      if (editingId === recordId) resetForm();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete the record.");
    }
  }

  return (
    <div className="record-grid">
      <form className="panel" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{editingId ? "Edit record" : "New record"}</p>
            <h2>{editingId ? "Update the selected record" : "Save a protected record"}</h2>
          </div>
        </div>

        <label className="field">
          <span>Title</span>
          <input maxLength={120} required value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>

        <label className="field">
          <span>Content</span>
          <textarea maxLength={5000} rows={8} value={content} onChange={(event) => setContent(event.target.value)} />
        </label>

        {error ? <p className="error-message" role="alert">{error}</p> : null}

        <div className="button-row">
          <button className="button primary" disabled={saving} type="submit">{saving ? "Saving…" : editingId ? "Update" : "Save"}</button>
          {editingId ? <button className="button secondary" type="button" onClick={resetForm}>Cancel</button> : null}
        </div>
      </form>

      <section className="panel" aria-live="polite">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Your data</p>
            <h2>{records.length} {records.length === 1 ? "record" : "records"}</h2>
          </div>
          <span className="status-badge">Owner only</span>
        </div>

        <div className="record-list">
          {records.length ? records.map((record) => (
            <article className="record-card" key={record.id}>
              <div>
                <h3>{record.title}</h3>
                {record.content ? <p>{record.content}</p> : null}
              </div>
              <div className="record-actions">
                <button type="button" onClick={() => startEditing(record)}>Edit</button>
                <button type="button" onClick={() => removeRecord(record.id)}>Delete</button>
              </div>
            </article>
          )) : <p className="empty-state">No records yet. Save the first one to verify persistence.</p>}
        </div>
      </section>
    </div>
  );
}
