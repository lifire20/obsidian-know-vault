---
tags:
  - API
  - System
---
在 Java 中，`java.lang.System` 是一个非常特殊的核心类。它包含了几个非常有用的类字段（常量）和静态方法，主要用于**标准输入输出、系统信息获取、以及垃圾回收等底层操作**。

因为它的所有成员都是静态的（`static`），所以你可以直接通过 `System.xxx()` 来调用，不需要 `new` 一个对象。

以下是 `System` 类最常用的方法，我按使用频率和功能帮你分好类了：

---

### 一、 输入输出（最常用）

| 方法/属性 | 说明 | 示例 |
| :--- | :--- | :--- |
| ** `System.out` ** | 标准输出流（控制台），最常用的打印方法 | `System.out.println("Hello");` |
| ** `System.err` ** | 标准错误输出流（控制台，字体通常是红色的） | `System.err.println("出错了！");` |
| ** `System.in` ** | 标准输入流（键盘），通常配合 `Scanner` 使用 | `Scanner sc = new Scanner(System.in);` |

*注意：`out`、`err`、`in` 是静态属性（类字段），不是方法。*

---

### 二、 数组操作（底层拷贝，极快）

| 方法                                                                              | 说明                                                                                  | 示例                                                                                           |
| :------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| ** `arraycopy(Object src, int srcPos, Object dest, int destPos, int length)` ** | **极其重要！** 用于高效地复制数组。它直接把内存里的数据按块复制过去，比用 `for` 循环赋值快得多。很多集合类（如 `ArrayList`）底层扩容都是用它。 | 把 `arr1` 从第 0 位开始的 3 个元素，复制到 `arr2` 的第 1 位开始的位置：<br>`System.arraycopy(arr1, 0, arr2, 1, 3);` |
![[Pasted image 20261026153701.png]]

 
---

### 三、 程序控制（退出与时间）

| 方法 | 说明 | 示例 |
| :--- | :--- | :--- |
| ** `exit(int status)` ** | **强制终止当前 Java 虚拟机（JVM）**。`status` 为 `0` 表示正常退出，非 `0` 表示异常退出。**（注意：`finally` 代码块里的代码也会被执行前被打断，慎用）** | `System.exit(0);` |
| ** `currentTimeMillis()` ** | 获取当前系统时间，返回从 **1970 年 1 月 1 日 0 点** 到现在的**毫秒数**。常用于计算代码运行时间。 | `long start = System.currentTimeMillis();`<br>`// ... 运行代码 ...`<br>`long end = System.currentTimeMillis();` |
| ** `nanoTime()` ** | 返回当前 JVM 的高精度时间（纳秒），只能用于计算时间差（做性能测试），不能用来算日期。 | `long time = System.nanoTime();` |

---

### 四、 垃圾回收与系统信息

| 方法                              | 说明                                                                     | 示例                                                     |
| :------------------------------ | :--------------------------------------------------------------------- | :----------------------------------------------------- |
| ** `gc()` **                    | 提醒 JVM 回收垃圾（释放内存）。**注意：这仅仅是“建议”，JVM 不一定马上执行。** 实际开发中几乎不用手动调，JVM 自己会处理。 | `System.gc();`                                         |
| ** `getProperties()` **         | 获取当前系统的所有属性（如操作系统名称、Java 版本、用户名等），返回一个 `Properties` 对象。                | `System.out.println(System.getProperties());`          |
| ** `getProperty(String key)` ** | 获取指定的系统属性。                                                             | `String os = System.getProperty("os.name");`（获取操作系统名称） |

---

### 五、 Java 9 以后的实用新特性：`System.arraycopy` 的平替

在 Java 9+ 中，`System` 类多了一个专门用来拷贝数组的工具方法，比原来的 `arraycopy` 参数少，更好记：

| 方法 | 说明 | 示例 |
| :--- | :--- | :--- |
| ** `arraycopy` ** 的现代版 | 在 Java 9 中加入。用于复制数组的指定区间。 | `int[] arr2 = Arrays.copyOfRange(arr1, 1, 3);` (这是 `Arrays` 类的方法，更推荐用这个) |

---

### 💡 一个非常实用的代码片段（计算代码运行时间）

结合你之前学过的知识，我们可以用 `currentTimeMillis()` 来测一下你写的判断质数的方法跑得有多快：

```java
public class SystemDemo {
    public static void main(String[] args) {
        // 1. 记录开始时间（毫秒）
        long startTime = System.currentTimeMillis();

        // 2. 运行一段比较耗时的代码，比如判断 997 是不是质数
        boolean result = isPrime(997);

        // 3. 记录结束时间
        long endTime = System.currentTimeMillis();

        // 4. 计算耗时
        System.out.println("判断结果是：" + result);
        System.out.println("这段代码总共运行了：" + (endTime - startTime) + " 毫秒");
    }

    public static boolean isPrime(int number) {
        if (number <= 1) return false;
        for (int i = 2; i <= Math.sqrt(number); i++) {
            if (number % i == 0) return false;
        }
        return true;
    }
}
```

**总结记忆口诀：**
*   **想打印**找 `out` / `err`
*   **想输**入找 `in`
*   **想退出**找 `exit`
*   **想计时**找 `currentTimeMillis`
*   **想拷数组**找 `arraycopy`