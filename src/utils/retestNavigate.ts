interface PendingRetest {
  buildingId: string;
  floor: number;
}

let pendingRetest: PendingRetest | null = null;

export const setPendingRetest = (data: PendingRetest) => {
  pendingRetest = data;
};

export const consumePendingRetest = (): PendingRetest | null => {
  const data = pendingRetest;
  pendingRetest = null;
  return data;
};
