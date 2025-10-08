import React from "react";
import { Tab } from "~/components/App";

interface FooterProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  showWallet?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ activeTab, setActiveTab, showWallet = false }) => (
  <div className="fixed bottom-0 left-0 right-0 mx-4 mb-4 bg-gray border-t-[3px] border-l-[3px] border-r-[3px] border-primary px-2 py-2 rounded-lg z-50">
    <div className="flex justify-around items-center h-14">
      <button
        onClick={() => setActiveTab(Tab.Home)}
        className={`flex flex-col items-center justify-center w-full h-full ${
          activeTab === Tab.Home ? 'text-primary dark:text-primary-light' : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        <span className="text-xl">🏠</span>
        <span className="text-xs mt-1">Home</span>
      </button>
      <button
        onClick={() => setActiveTab(Tab.Races)}
        className={`flex flex-col items-center justify-center w-full h-full ${
          activeTab === Tab.Actions ? 'text-primary dark:text-primary-light' : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        <span className="text-xl">🐎</span>
        <span className="text-xs mt-1">Races</span>
      </button>

      {showWallet && (
        <button
          onClick={() => setActiveTab(Tab.Wallet)}
          className={`flex flex-col items-center justify-center w-full h-full ${
            activeTab === Tab.Wallet ? 'text-primary dark:text-primary-light' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          <span className="text-xl">👤</span>
          <span className="text-xs mt-1">Profile</span>
        </button>
      )}
    </div>
  </div>
);
