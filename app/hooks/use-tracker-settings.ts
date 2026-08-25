import { useState, type Dispatch, type SetStateAction } from "react";
import { replaceCategory } from "../../lib/domain/relationships";
import type { Category, Goal, Habit, HabitCategory, WeeklyHabit } from "../../lib/domain/tracker-state";

type Options = {
  categories: Category[];
  setCategories: Dispatch<SetStateAction<Category[]>>;
  setDaily: Dispatch<SetStateAction<Habit[]>>;
  setWeekly: Dispatch<SetStateAction<WeeklyHabit[]>>;
  setGoals: Dispatch<SetStateAction<Goal[]>>;
  motivations: string[];
  setMotivations: Dispatch<SetStateAction<string[]>>;
  selectedCategory: HabitCategory;
  setSelectedCategory: Dispatch<SetStateAction<HabitCategory>>;
  selectedChartCategory: HabitCategory;
  setSelectedChartCategory: Dispatch<SetStateAction<HabitCategory>>;
  palette: string[];
  defaultColor: string;
};

export function useTrackerSettings({
  categories, setCategories, setDaily, setWeekly, setGoals, motivations, setMotivations,
  selectedCategory, setSelectedCategory, selectedChartCategory, setSelectedChartCategory,
  palette, defaultColor,
}: Options) {
  const [motivationManagerOpen, setMotivationManagerOpen] = useState(false);
  const [motivationDraft, setMotivationDraft] = useState("");
  const [editingMotivationIndex, setEditingMotivationIndex] = useState<number | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<HabitCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState(defaultColor);
  const [categoryIcon, setCategoryIcon] = useState("●");
  const [deletingCategoryId, setDeletingCategoryId] = useState<HabitCategory | null>(null);
  const [replacementCategoryId, setReplacementCategoryId] = useState<HabitCategory>("health");

  function startCategoryEdit(category?: Category) {
    setEditingCategoryId(category?.id ?? null);
    setCategoryName(category?.label ?? "");
    setCategoryColor(category?.color ?? palette[categories.length % palette.length]);
    setCategoryIcon(category?.icon ?? "●");
  }

  function saveCategory() {
    const label = categoryName.trim();
    if (!label) return;
    if (editingCategoryId) {
      setCategories((items) => items.map((category) => category.id === editingCategoryId ? { ...category, label, color: categoryColor, icon: categoryIcon.trim().slice(0, 2) || "●" } : category));
    } else {
      const id = `block-${Date.now()}`;
      setCategories((items) => [...items, { id, label, color: categoryColor, icon: categoryIcon.trim().slice(0, 2) || "●" }]);
      setSelectedCategory(id);
    }
    setEditingCategoryId(null);
    setCategoryName("");
  }

  function toggleCategoryPriority(categoryId: HabitCategory) {
    setCategories((items) => items.map((category) => category.id === categoryId ? { ...category, priority: !category.priority } : category));
  }

  function requestCategoryDelete(categoryId: HabitCategory) {
    const replacement = categories.find((category) => category.id !== categoryId);
    if (!replacement) return;
    setDeletingCategoryId(categoryId);
    setReplacementCategoryId(replacement.id);
  }

  function deleteCategory() {
    if (!deletingCategoryId || deletingCategoryId === replacementCategoryId) return;
    setDaily((items) => replaceCategory(items, deletingCategoryId, replacementCategoryId));
    setWeekly((items) => replaceCategory(items, deletingCategoryId, replacementCategoryId));
    setGoals((items) => replaceCategory(items, deletingCategoryId, replacementCategoryId));
    setCategories((items) => items.filter((category) => category.id !== deletingCategoryId));
    if (selectedChartCategory === deletingCategoryId) setSelectedChartCategory(replacementCategoryId);
    if (selectedCategory === deletingCategoryId) setSelectedCategory(replacementCategoryId);
    setDeletingCategoryId(null);
  }

  function saveMotivation() {
    const text = motivationDraft.trim().replace(/\s+/g, " ");
    if (!text) return;
    if (editingMotivationIndex === null) {
      if (!motivations.some((item) => item.toLocaleLowerCase("es") === text.toLocaleLowerCase("es"))) {
        setMotivations((items) => [...items, text]);
      }
    } else {
      setMotivations((items) => items.map((item, index) => index === editingMotivationIndex ? text : item));
    }
    setMotivationDraft("");
    setEditingMotivationIndex(null);
  }

  function editMotivation(index: number) {
    setMotivationDraft(motivations[index]);
    setEditingMotivationIndex(index);
  }

  function deleteMotivation(index: number) {
    setMotivations((items) => items.filter((_, itemIndex) => itemIndex !== index));
    if (editingMotivationIndex === index) {
      setMotivationDraft("");
      setEditingMotivationIndex(null);
    }
  }

  function cancelMotivationEdit() {
    setEditingMotivationIndex(null);
    setMotivationDraft("");
  }

  return {
    motivationManagerOpen, setMotivationManagerOpen, motivationDraft, setMotivationDraft,
    editingMotivationIndex, cancelMotivationEdit, saveMotivation, editMotivation, deleteMotivation,
    categoryManagerOpen, setCategoryManagerOpen, editingCategoryId, categoryName, setCategoryName,
    categoryColor, setCategoryColor, categoryIcon, setCategoryIcon, deletingCategoryId, setDeletingCategoryId,
    replacementCategoryId, setReplacementCategoryId, startCategoryEdit, saveCategory,
    toggleCategoryPriority, requestCategoryDelete, deleteCategory,
  };
}
