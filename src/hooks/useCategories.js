import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCategories, addCategory, updateCategory, deleteCategory, getCategoryQuestionCount } from '../lib/firestore';

export const useCategories = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getCategories(user.uid);
      setCategories(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const addCategoryFn = async (name) => {
    const id = await addCategory(user.uid, name, categories.length);
    await fetchCategories();
    return id;
  };

  const updateCategoryFn = async (categoryId, updates) => {
    await updateCategory(user.uid, categoryId, updates);
    await fetchCategories();
  };

  const deleteCategoryFn = async (categoryId) => {
    await deleteCategory(user.uid, categoryId);
    await fetchCategories();
  };

  const getQuestionCount = async (categoryId) => {
    return getCategoryQuestionCount(user.uid, categoryId);
  };

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
    addCategory: addCategoryFn,
    updateCategory: updateCategoryFn,
    deleteCategory: deleteCategoryFn,
    getQuestionCount,
  };
};
