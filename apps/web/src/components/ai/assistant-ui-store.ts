"use client";

import { create } from "zustand";

type AssistantUIMode = "modal" | "sidebar";

type AssistantUIState = {
	mode: AssistantUIMode;
	isSidebarOpen: boolean;
	isModalOpen: boolean;
	setMode: (mode: AssistantUIMode) => void;
	setSidebarOpen: (open: boolean) => void;
	setModalOpen: (open: boolean) => void;
	openSidebar: () => void;
	closeSidebar: () => void;
};

export const useAssistantUIStore = create<AssistantUIState>((set) => ({
	mode: "modal",
	isSidebarOpen: false,
	isModalOpen: false,
	setMode: (mode) => set({ mode }),
	setSidebarOpen: (open) => set({ isSidebarOpen: open }),
	setModalOpen: (open) => set({ isModalOpen: open }),
	openSidebar: () => set({ mode: "sidebar", isSidebarOpen: true }),
	closeSidebar: () => set({ isSidebarOpen: false }),
}));


