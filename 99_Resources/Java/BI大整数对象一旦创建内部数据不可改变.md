你问的是"BigInteger对象一旦创建，里面的数据不会发生改变"这句话本身怎么理解。我拆开解释：

字面意思

创建一个 BigInteger 后，它代表的数值就固定了，你没法通过任何方法把它从 100 改成 200。所有看起来像"修改"的操作，其实都是生成了一个新的 BigInteger 对象，原来的对象原封不动。

关键点：没有"修改"的方法

看 BigInteger 的 API 你会发现，它根本没有 setValue()、addTo() 这类原地修改的方法。它提供的都是：

```java
BigInteger a = new BigInteger("100");

BigInteger b = a.add(BigInteger.TEN);   // a 还是 100，b 是 110
BigInteger c = a.multiply(BigInteger.TWO); // a 还是 100，c 是 200
```

a.add(...) 不是"把 a 加上去"，而是"算出一个新结果返回"。a 从头到尾都是 100。

对比"可变"对象就好懂了

比如 StringBuilder 是可变的：

```java
StringBuilder sb = new StringBuilder("100");
sb.append("0");   // sb 自己变成了 "1000"，还是同一个对象
```

而 BigInteger 对应的写法：

```java
BigInteger a = new BigInteger("100");
a = a.multiply(BigInteger.TEN);  // 注意：这是把变量 a 指向了新对象
```

这里第二行的 a = 容易让人误以为"a 被改了"。其实不是——是旧的 100 那个对象没动，只是变量 a 换指向了一个新建的 1000 对象。原来那个 100 对象如果没别的引用，就被垃圾回收了。

一句话解释

"里面的数据不会发生改变" = 这个对象内部的数值是只读的，任何运算都返回新对象，绝不原地修改自己。你看到变量"变了"，那是变量重新指向了新对象，不是老对象被改了。

这也是为什么它叫不可变对象（immutable）。