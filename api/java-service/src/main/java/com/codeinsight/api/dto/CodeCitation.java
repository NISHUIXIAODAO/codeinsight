package com.codeinsight.api.dto;

public class CodeCitation {
    private String chunk_id;
    private String file_path;
    private int start_line;
    private int end_line;
    private double score;

    public CodeCitation() {
    }

    public CodeCitation(String chunk_id, String file_path, int start_line, int end_line, double score) {
        this.chunk_id = chunk_id;
        this.file_path = file_path;
        this.start_line = start_line;
        this.end_line = end_line;
        this.score = score;
    }

    public String getChunk_id() {
        return chunk_id;
    }

    public void setChunk_id(String chunk_id) {
        this.chunk_id = chunk_id;
    }

    public String getFile_path() {
        return file_path;
    }

    public void setFile_path(String file_path) {
        this.file_path = file_path;
    }

    public int getStart_line() {
        return start_line;
    }

    public void setStart_line(int start_line) {
        this.start_line = start_line;
    }

    public int getEnd_line() {
        return end_line;
    }

    public void setEnd_line(int end_line) {
        this.end_line = end_line;
    }

    public double getScore() {
        return score;
    }

    public void setScore(double score) {
        this.score = score;
    }
}

