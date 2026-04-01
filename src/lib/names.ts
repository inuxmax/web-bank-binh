const maleNames = [
  'An', 'Bình', 'Cường', 'Dũng', 'Hùng', 'Huy', 'Khánh', 'Kiên', 'Long', 'Nam',
  'Phong', 'Quân', 'Sơn', 'Thành', 'Thắng', 'Tuấn', 'Việt', 'Vinh', 'Quang', 'Tài',
];

const femaleNames = [
  'Ánh', 'Dung', 'Hạnh', 'Hương', 'Lan', 'Loan', 'Mai', 'Ngọc', 'Phương',
  'Thu', 'Trang', 'Vân', 'Yến', 'Hà', 'Hằng', 'Linh', 'Thảo', 'Diệu',
];

const prefix = ['Nguyễn Văn', 'Trần Văn', 'Lê Văn', 'Phạm Văn', 'Nguyễn Thị', 'Trần Thị', 'Lê Thị', 'Phạm Thị'];

export function randomName(): string {
  const p = prefix[Math.floor(Math.random() * prefix.length)]!;
  if (p.includes('Thị')) {
    return `${p} ${femaleNames[Math.floor(Math.random() * femaleNames.length)]}`;
  }
  return `${p} ${maleNames[Math.floor(Math.random() * maleNames.length)]}`;
}
