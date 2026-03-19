import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';

type Reaction = 'touched' | 'comforted' | 'neutral';

export function useFeedback(
  type: 'letter' | 'wisdom',
  targetId: string,
  mentorId: string
) {
  const { user } = useAuth();
  const [feedbackDocId, setFeedbackDocId] = useState<string | null>(null);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoaded(true);
      return;
    }
    getDocs(
      query(
        collection(db, 'feedback'),
        where('uid', '==', user.uid),
        where('targetId', '==', targetId)
      )
    )
      .then((snap) => {
        if (!snap.empty) {
          setFeedbackDocId(snap.docs[0].id);
          setReaction(snap.docs[0].data().reaction as Reaction);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [user, targetId]);

  const submitReaction = async (r: Reaction) => {
    if (!user || saving || r === reaction) return;
    setSaving(true);
    try {
      if (feedbackDocId) {
        await updateDoc(doc(db, 'feedback', feedbackDocId), { reaction: r });
      } else {
        const ref = await addDoc(collection(db, 'feedback'), {
          uid: user.uid,
          type,
          targetId,
          mentorId,
          reaction: r,
          createdAt: serverTimestamp(),
        });
        setFeedbackDocId(ref.id);
      }
      setReaction(r);
    } catch {}
    setSaving(false);
  };

  return { reaction, loaded, saving, submitReaction };
}
