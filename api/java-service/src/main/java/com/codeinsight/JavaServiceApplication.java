package com.codeinsight;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class JavaServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(JavaServiceApplication.class, args);
    }
}
