import AsyncStorage from '@react-native-async-storage/async-storage';
import { equalTo, onValue, orderByChild, query, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import { getFirebaseDB } from '../constants/firebase';

const countNewOrdersForUser = (ordersList: any[], user: any) => {
  if (!user) return 0;
  const userRole = user.role;
  const userId = user.uid || user.id;

  if (!userId) return 0;

  return ordersList.filter((order: any) => {
    if (order.status !== 'new') return false;

    if (userRole === 'doctor') {
      return order.doctorId === userId;
    } else if (userRole === 'technician') {
      return order.technicianId === userId;
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

    const userId = user.uid || user.id;
    if (!userId) return;

    const field = user.role === 'doctor' ? 'doctorId' : 'technicianId';
    const ordersRef = query(ref(getFirebaseDB(), 'orders'), orderByChild(field), equalTo(userId));
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
