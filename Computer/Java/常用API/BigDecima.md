---
tags:
  - BigDecima
---
### 计算机中小数的存储方式
[[小数部分转换成二进制的方法]]
![[Pasted image 20261028090854.png]]
浮点数类型占用的字节数是不一样的
![[Pasted image 20261028091552.png]]
float 占用 4 个字节，给小数存储的是 23 个 bit 位
double 占用 8 个字节，给小数存储 52 个 bit 位
这样就导致了小数存储不精确
### 创建对象

可以用**传递字符串表示的小数**来创建对象
`BigDecimal bd =new BigDecimal(0.01)`（构造方法）
也可以用**静态方法**获取对象
`BigDecimal bd =BigDecimal.valueOf(10)`

另外，BD 的 valueOf 也对 0-10 （全闭区间）之间的整数做了优化，如果传递的事这些整数，会返回已经创建好的对象，不会重新 new。 

### 成员方法
`BigDecimal` 的常见成员方法按功能分类整理如下：

| 功能类别 | 方法签名 | 说明 |
| :--- | :--- | :--- |
| **算术运算** | `add(BigDecimal augend)` | 加法，返回 `(this + augend)` |
| | `subtract(BigDecimal subtrahend)` | 减法，返回 `(this - subtrahend)` |
| | `multiply(BigDecimal multiplicand)` | 乘法，返回 `(this × multiplicand)` |
| | `divide(BigDecimal divisor)` | 除法。若商为无限循环小数则抛出 `ArithmeticException` |
| | `divide(BigDecimal divisor, int scale, RoundingMode roundingMode)` | 指定精度和舍入模式的除法 |
| | `remainder(BigDecimal divisor)` | 取余，返回 `(this % divisor)` |
| | `pow(int n)` | 幂运算，返回 `(this^n)` |
| | `abs()` | 绝对值 |
| | `negate()` | 取反，返回 `(-this)` |
| **比较** | `compareTo(BigDecimal val)` | 数值比较（忽略精度差异），返回 -1、0 或 1 |
| | `equals(Object x)` | 严格相等比较（数值和精度都必须相同） |
| | `max(BigDecimal val)` / `min(BigDecimal val)` | 返回较大值或较小值 |
| **精度与舍入** | `setScale(int newScale, RoundingMode roundingMode)` | 设置精度（小数位数）并指定舍入模式 |
| | `round(MathContext mc)` | 按 `MathContext` 设置进行舍入 |
| | `scale()` | 返回当前精度（小数位数） |
| **小数点移动** | `movePointLeft(int n)` | 小数点左移 `n` 位 |
| | `movePointRight(int n)` | 小数点右移 `n` 位 |
| **类型转换** | `intValue()` / `longValue()` / `doubleValue()` | 转换为对应基本类型（可能丢失精度） |
| | `toBigInteger()` | 转换为 `BigInteger`（丢弃小数部分） |
| | `toPlainString()` | 返回不带指数的字符串表示 |
| **静态工厂** | `valueOf(long val)` | 将 `long` 转为 `BigDecimal`（推荐优先于构造器） |

#### 关键注意点
- **除法必须指定舍入**：`divide(BigDecimal)` 在遇到无限循环小数（如 `1/3`）时会抛出异常，实际开发中应使用带 `scale` 和 `RoundingMode` 参数的重载方法。
- ** `compareTo` 与 `equals` 的区别**：`compareTo` 只比较数值（`2.0` 与 `2.00` 视为相等），`equals` 要求数值和精度都相同（`2.0` 与 `2.00` 不相等）。
- **构造器选择**：使用 `new BigDecimal(double)` 可能产生精度问题，推荐使用 `new BigDecimal(String)` 或 `BigDecimal.valueOf(double)`。

### BD 的底层存储模式
![[Pasted image 20261028141526.png]]
![[Pasted image 20261028141405.png]]
把小数的每一位都拿出来变成字符来存储，然后再用 ASSCI 码表转换并储存在数组中。