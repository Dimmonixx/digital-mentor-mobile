import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { database } from '../constants/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const countNewOrdersForUser = (ordersList: any[], user: any) => {
  if (!user) return 0;
  const userRole = user.role;
  const userName = user.name;

  return ordersList.filter((order: any) => {
    if (order.status !== 'new') return false;
    
    if (userRole === 'doctor') {
      return order.doctor?.name === userName;
    } else if (userRole === 'technician') {
      return order.technician?.name === userName;
    }
    return false;
  }).length;
};

export const useNewOrdersCount = () => {
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    AsyncStorage.getItem('user').then((data) => {
      if (data) setUser(JSON.parse(data));
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    const ordersRef = ref(database, 'orders');
    const unsubscribe = onValue(
      ordersRef,
      (snapshot) => {
        const data = snapshot.val();
        let currentNewOrdersCount = 0;

        if (data) {
          const ordersList = Object.entries(data).map(([id, order]: any) => ({
            id,
            ...order,
          }));
          currentNewOrdersCount = countNewOrdersForUser(ordersList, user);
        }

        setNewOrdersCount(currentNewOrdersCount);
      },
      (error) => {
        console.error('Ошибка при получении новых нарядов для колокольчика:', error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return newOrdersCount;
};
