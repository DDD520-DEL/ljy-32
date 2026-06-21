import React, { useEffect } from 'react';
import { useDidShow, useDidHide } from '@tarojs/taro';
import { DataProvider } from './store/DataContext';
import { storage } from './utils/storage';
import { neighborStorage } from './utils/invitation';
import { mockBuildings, generateMockRecords } from './data/mockData';
import './app.scss';

function App(props) {
  useEffect(() => {
    const existingBuildings = storage.getBuildings();
    if (existingBuildings.length === 0) {
      console.log('[App] 初始化 Mock 数据');
      storage.saveBuildings(mockBuildings);
      const mockRecords = generateMockRecords(mockBuildings);
      storage.saveRecords(mockRecords);
      storage.saveCurrentBuildingId(mockBuildings[0].id);
    }

    neighborStorage.ensureCurrentUser();
  }, []);

  useDidShow(() => {
    console.log('[App] App did show');
  });

  useDidHide(() => {
    console.log('[App] App did hide');
  });

  return <DataProvider>{props.children}</DataProvider>;
}

export default App;
