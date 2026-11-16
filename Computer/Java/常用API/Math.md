---
tags:
  - API
  - Math
---
# Java Math 类常用方法详解

`java.lang.Math` 是一个工具类，所有方法都是**静态方法**，直接通过 `Math.方法名()` 调用。它包含 `E`（自然对数底数）和 `PI`（圆周率）两个常量。下面按功能分类讲解。

---

## 一、绝对值与符号

| 方法          | 说明                               | 示例                           |
| ----------- | -------------------------------- | ---------------------------- |
| `abs(x)`    | 返回绝对值，支持 int/long/float/double   | `Math.abs(-5)` → `5`         |
| `signum(x)` | 返回符号：正数返回 1.0，负数返回 -1.0，0 返回 0.0 | `Math.signum(-3.2)` → `-1.0` |

⚠️ **注意**：`Math.abs(Integer.MIN_VALUE)` 会返回负数（溢出），因为最小值取绝对值超出 int 范围。
可以用 absExact（）来返回溢出的错误信息

---

## 二、最大/最小值

| 方法 | 说明 | 示例 |
|------|------|------|
| `max(a, b)` | 返回较大值 | `Math.max(3, 7)` → `7` |
| `min(a, b)` | 返回较小值 | `Math.min(3, 7)` → `3` |

同样支持 int/long/float/double 四种重载。

---

## 三、取整相关

| 方法         | 说明                             | 示例                                                    |
| ---------- | ------------------------------ | ----------------------------------------------------- |
| `ceil(x)`  | **向上取整**，返回 ≥ x 的最小整数（double）  | `Math.ceil(2.1)` → `3.0`；`Math.ceil(-2.1)` → `-2.0`   |
| `floor(x)` | **向下取整**，返回 ≤ x 的最大整数（double）  | `Math.floor(2.9)` → `2.0`；`Math.floor(-2.1)` → `-3.0` |
| `round(x)` | **四舍五入**。float→int，double→long | `Math.round(2.5)` → `3`；`Math.round(-2.5)` → `-2`     |
| `rint(x)`  | 舍入到最近整数（银行家舍入，.5 取偶）           | `Math.rint(2.5)` → `2.0`                              |

⚠️ `round` 的规则是 `floor(x + 0.5)`，所以 `Math.round(-2.5)` 结果是 `-2` 而不是 `-3`。

---

## 四、幂、开方与指数

| 方法 | 说明 | 示例 |
|------|------|------|
| `pow(a, b)` | a 的 b 次方，返回 double | `Math.pow(2, 10)` → `1024.0` |
| `sqrt(x)` | 平方根 | `Math.sqrt(16)` → `4.0` |
| `cbrt(x)` | 立方根 | `Math.cbrt(27)` → `3.0` |
| `exp(x)` | e 的 x 次方 | `Math.exp(1)` → `2.718...` |
| `expm1(x)` | e^x - 1，x 很小时精度更高 | — |
| `hypot(x, y)` | √(x²+y²)，避免中间溢出 | `Math.hypot(3, 4)` → `5.0` |

---

## 五、对数

| 方法 | 说明 | 示例 |
|------|------|------|
| `log(x)` | 自然对数 ln(x) | `Math.log(Math.E)` → `1.0` |
| `log10(x)` | 以 10 为底的对数 | `Math.log10(1000)` → `3.0` |
| `log1p(x)` | ln(1 + x)，x 很小时精度更高 | — |

---

## 六、三角函数（参数均为**弧度**）

| 方法 | 说明 |
|------|------|
| `sin(x)` / `cos(x)` / `tan(x)` | 正弦 / 余弦 / 正切 |
| `asin(x)` / `acos(x)` / `atan(x)` | 反正弦 / 反余弦 / 反正切 |
| `atan2(y, x)` | 根据坐标求角度，范围 [-π, π]，比 atan 更准确 |
| `toRadians(deg)` | 角度转弧度 |
| `toDegrees(rad)` | 弧度转角度 |

```java
double angle = Math.toRadians(90);   // 1.5708
Math.sin(angle);                      // 1.0
Math.toDegrees(Math.PI / 2);         // 90.0
```

---

## 七、随机数

| 方法 | 说明 |
|------|------|
| `random()` | 返回 `[0.0, 1.0)` 的随机 double |

```java
// 生成 [1, 100] 的随机整数
int n = (int)(Math.random() * 100) + 1;
```

如果需要更灵活的随机数（如指定范围、种子、线程安全），推荐用 `java.util.Random` 或 `ThreadLocalRandom`。

---

## 八、其他实用方法（Java 8+）

| 方法 | 说明 | 示例 |
|------|------|------|
| `floorDiv(a, b)` | 向下取整的除法 | `Math.floorDiv(-7, 2)` → `-4`（普通 `/` 得 -3） |
| `floorMod(a, b)` | 结果符号与除数一致的取模 | `Math.floorMod(-7, 2)` → `1` |
| `addExact(a, b)` | 加法，溢出抛 `ArithmeticException` | — |
| `subtractExact` / `multiplyExact` | 减法/乘法精确运算，溢出抛异常 | — |
| `negateExact(x)` | 取负，溢出抛异常 | — |
| `toIntExact(long)` | long 转 int，溢出抛异常 | — |
| `copySign(x, y)` | 取 x 的绝对值，符号取 y 的符号 | `Math.copySign(3, -1)` → `-3.0` |
| `nextUp(x)` / `nextDown(x)` | 返回相邻的浮点数 | — |

---

## 九、综合示例

```java
public class MathDemo {
    public static void main(String[] args) {
        System.out.println(Math.abs(-10));        // 10
        System.out.println(Math.max(5, 8));       // 8
        System.out.println(Math.ceil(3.14));      // 4.0
        System.out.println(Math.floor(3.99));     // 3.0
        System.out.println(Math.round(3.5));      // 4
        System.out.println(Math.pow(2, 8));       // 256.0
        System.out.println(Math.sqrt(81));        // 9.0
        System.out.println(Math.log10(100));      // 2.0
        System.out.println(Math.toDegrees(Math.PI)); // 180.0
        System.out.println(Math.floorDiv(-7, 2)); // -4
        System.out.println(Math.floorMod(-7, 2)); // 1
        System.out.println(Math.random());        // [0.0, 1.0) 随机数
    }
}
```

---

## 关键记忆点

1. **`ceil` 向上、`floor` 向下、`round` 四舍五入**，三者返回值类型不同：ceil/floor 返回 double，round 返回 long 或 int。
2. **round(-2.5) = -2**，负数的四舍五入容易出错。
3. 三角函数**参数是弧度**，用 `toRadians` 转换。
4. 需要**精确整数运算防溢出**时用 `xxxExact` 系列。
5. 取模符号不同用 `floorMod`，除法不同用 `floorDiv`。

