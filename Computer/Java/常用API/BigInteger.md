---
tags:
  - BigInteger
  - valueOf方法
---
## 构造方法
![[Screenshot_20261027_165607.jpg]]
BI 创建的对象一旦被创建，内部数据就不可改变了
[[BI大整数对象一旦创建内部数据不可改变]]
#### valueOf（）静态方法

调用 valueOf 静态方法和直接用 BI 获取大整数的方式区别为:取值范围不同,前者只能取到 long类型，后者的范围比 long类型更大。
valueOf 方法对-16 到 16 之间进行了优化，即提前创建好了这些数字的对象。如果多次获取这些数字，不会创建新的对象。
![[Screenshot_20261027_171438.jpg]]
## 成员方法
`BigInteger` 所有运算都通过对象调用方法完成，且结果返回新对象，原对象不变。用于处理超出 `long` 范围的大整数，是不可变类。其常见成员方法可按功能分类如下：

### 算术运算
- **`add(BigInteger val)`**：加法，返回 `(this + val)`。
- **`subtract(BigInteger val)`**：减法，返回 `(this - val)`。
- **`multiply(BigInteger val)`**：乘法，返回 `(this * val)`。
- **`divide(BigInteger val)`**：除法，返回 `(this / val)`。除数为零时抛出 `ArithmeticException`。
- **`remainder(BigInteger val)`**：取余，返回 `(this % val)`。
- **`pow(int exponent)`**：幂运算，返回 `(this^exponent)`。指数不能为负。
- **`abs()`**：绝对值。
- **`negate()`**：取反，返回 `(-this)`。

### 比较与值获取
- **`compareTo(BigInteger val)`**：比较大小，返回 -1、0 或 1。推荐用此方法替代 `<`、`>` 等运算符。
- **`equals(Object x)`**：判断数值是否相等。
- **`min(BigInteger val)` / `max(BigInteger val)`**：返回两者中的较小值或较大值。
- **`signum()`**：返回符号函数值（-1、0 或 1）。

### 类型转换与进制表示
- **`toString(int radix)`**：返回指定进制（2~36）的字符串表示。
- **`intValue()` / `longValue()`**：转换为 `int` 或 `long`（可能丢失精度）。
- **`toByteArray()`**：返回二进制补码形式的字节数组。

### 位运算
- **`and(BigInteger val)` / `or(BigInteger val)` / `xor(BigInteger val)`**：与、或、异或。
- **`not()`**：按位取反。
- **`shiftLeft(int n)` / `shiftRight(int n)`**：左移/右移 `n` 位。
- **`testBit(int n)`**：测试指定位是否为 1。
- **`setBit(int n)` / `clearBit(int n)` / `flipBit(int n)`**：设置、清除、翻转指定位。

### 数论与静态工具
- **`gcd(BigInteger val)`**：返回最大公约数。
- **`modPow(BigInteger exponent, BigInteger m)`**：模幂运算 `(this^exponent mod m)`。
- **`modInverse(BigInteger m)`**：模逆元。
- **`isProbablePrime(int certainty)`**：判断是否可能为素数。
- **`valueOf(long val)`**：静态工厂方法，优先于构造器使用。

### 常量
类中提供了常用常量：** `ZERO` **、** `ONE` **、** `TWO` **、** `TEN` **。

## 底层原理
![[Pasted image 20261028090703.png]]