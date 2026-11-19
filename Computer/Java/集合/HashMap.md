---
tags:
  - HashMap
  - 双列集合
---
- 无特有方法，可直接使用 Map 里面的方法
- 特点都是由键决定的，无序，不重复，无索引
- HashMap 和 [[HashSet]] 的底层原理是一模一样的，都是哈希表结构
- 依赖hashCode方法和equals方法保证键的唯一
- 如果**键**存储的是自定义对象，需要重写hashCode和equals方法
- 如果**值**存储自定义对象，不需要重写hashCode和equals方法

**例子**
需求，统计 80 个学生中对于 ABCD 4 个景点的票数
```
package demo3;  
  
import java.util.*;  
  
public class test {  
    public static void main(String[] args) {  
        ArrayList<String> list=new ArrayList<>();  
        Random r=new Random();  
        String[] arr1={"A","B","C","D"};  
  
        //存入票数和学生  
        for (int key=0;key<80;key++) {  
            int index=r.nextInt(arr1.length);  
            list.add(arr1[index]);  
  
        }        //存入景点  
        Map<String,Integer> m=new HashMap<>();  
        for (String name : list) {  
            if(m.containsKey(name)){  
                int count=m.get(name);  
                count++;  
                m.put(name,count);//覆盖原有的次数  
            }else {  
                m.put(name,1);//第一次存入  
            }  
        }        int max=0;  
        Set<Map.Entry<String, Integer>> entries = m.entrySet();  
        for (Map.Entry<String, Integer> entry : entries) {  
            int count=entry.getValue();  
            if(count>max){  
                max=count;  
            }        }        System.out.println(max);  
        for (Map.Entry<String, Integer> entry : entries) {  
            int count=entry.getValue();  
            if(count==max){  
                System.out.println(entry.getKey());  
            }        }        System.out.println(m);  
  
  
    }}
```