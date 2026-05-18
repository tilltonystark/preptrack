import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getQuestions, addQuestion, updateQuestion, deleteQuestion, incrementPracticeCount, updateVoiceNoteLink, addQuestions } from '../lib/firestore';

export const useQuestions = (filters = {}) => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filterKey = JSON.stringify(filters);

  const fetchQuestions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getQuestions(user.uid, filters);
      setQuestions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filterKey]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const addQuestionFn = async (questionData) => {
    const id = await addQuestion(user.uid, questionData);
    await fetchQuestions();
    return id;
  };

  const addQuestionsBatch = async (questionsData) => {
    const ids = await addQuestions(user.uid, questionsData);
    await fetchQuestions();
    return ids;
  };

  const updateQuestionFn = async (questionId, updates) => {
    await updateQuestion(user.uid, questionId, updates);
    await fetchQuestions();
  };

  const deleteQuestionFn = async (questionId) => {
    await deleteQuestion(user.uid, questionId);
    await fetchQuestions();
  };

  const incrementPractice = async (questionId, currentCount) => {
    const newCount = await incrementPracticeCount(user.uid, questionId, currentCount);
    await fetchQuestions();
    return newCount;
  };

  const updateVoiceNote = async (questionId, link) => {
    await updateVoiceNoteLink(user.uid, questionId, link);
    await fetchQuestions();
  };

  return {
    questions,
    loading,
    error,
    refetch: fetchQuestions,
    addQuestion: addQuestionFn,
    addQuestions: addQuestionsBatch,
    updateQuestion: updateQuestionFn,
    deleteQuestion: deleteQuestionFn,
    incrementPractice,
    updateVoiceNote,
  };
};
